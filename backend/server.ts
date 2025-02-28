// Add these imports at the top of your file
import { Application, Router } from "https://deno.land/x/oak@v12.6.1/mod.ts";
import { oakCors } from "https://deno.land/x/cors@v1.2.2/mod.ts";
import { exists } from "https://deno.land/std@0.208.0/fs/exists.ts";
import { parse as csvParse } from "https://deno.land/std@0.208.0/csv/parse.ts";
import { stringify as csvStringify } from "https://deno.land/std@0.208.0/csv/stringify.ts";
import { dirname, resolve } from "https://deno.land/std@0.208.0/path/mod.ts";
import { load } from "https://deno.land/std@0.208.0/dotenv/mod.ts";

// Load environment variables from .env file
await load({ export: true });

// =========================================
// Load Configuration
// =========================================

const ENVIRONMENT = Deno.env.get("ENVIRONMENT") || "development";
const isProduction = ENVIRONMENT === "production";

// Server configuration
const PORT = parseInt(Deno.env.get("PORT") || "8000");
const HOST = Deno.env.get("HOST") || "0.0.0.0"; // Use 0.0.0.0 to allow connections from any network interface

// Authentication settings
const AUTH_USERNAME = Deno.env.get("AUTH_USERNAME") || "admin";
const AUTH_PASSWORD = Deno.env.get("AUTH_PASSWORD") || "password123";

if (!AUTH_USERNAME || !AUTH_PASSWORD) {
  console.error(
    "Error: AUTH_USERNAME and AUTH_PASSWORD must be set in .env file",
  );
  Deno.exit(1);
}

// CORS settings
const ALLOWED_ORIGINS = Deno.env.get("ALLOWED_ORIGINS")?.split(",") ||
  ["http://localhost:3000"];

// File paths
const STUDENT_DATA_PATH = Deno.env.get("STUDENT_DATA_FILE") ||
  "../data/student_data.csv";
const ATTENDANCE_PATH = Deno.env.get("ATTENDANCE_FILE") ||
  "../data/attendance.csv";

// Resolve absolute paths
const STUDENT_DATA_FILE = resolve(Deno.cwd(), STUDENT_DATA_PATH);
const ATTENDANCE_FILE = resolve(Deno.cwd(), ATTENDANCE_PATH);

// =========================================
// Server Setup
// =========================================

const app = new Application();
const router = new Router();

// Track authenticated sessions with a simple map
const activeSessions = new Map<
  string,
  { username: string; lastActive: number }
>();

// Enhanced session ID generation for better security
function generateSessionId(): string {
  // Use a longer, more secure session ID
  const buffer = new Uint8Array(32); // 256 bits
  crypto.getRandomValues(buffer);
  return Array.from(buffer)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

// Enhanced error logging function
function logError(context: string, error: unknown, sensitive: boolean = false) {
  const timestamp = new Date().toISOString();
  const errorObj = error as Error;

  // Basic error log
  console.error(`[${timestamp}] ERROR in ${context}: ${errorObj.message}`);

  // Add stack trace in development
  if (!isProduction && !sensitive) {
    console.error(errorObj.stack);
  }
}

// Improved async handler
function asyncHandler(
  handler: (ctx: any, next?: () => Promise<any>) => Promise<any>,
) {
  return async (ctx: any, next?: () => Promise<any>) => {
    try {
      await handler(ctx, next);
    } catch (err) {
      const error = err as Error;
      logError(`Route handler: ${ctx.request.url.pathname}`, error);

      ctx.response.status = 500;
      ctx.response.body = {
        success: false,
        message: isProduction ? "Internal server error" : error.message,
        // Add a request ID that can be used for troubleshooting
        requestId: crypto.randomUUID().slice(0, 8),
      };
    }
  };
}

// =========================================
// Middleware
// =========================================

// Add Helmet-like security headers
app.use(async (ctx, next) => {
  await next();

  // Security headers
  ctx.response.headers.set("X-Content-Type-Options", "nosniff");
  ctx.response.headers.set("X-Frame-Options", "DENY");
  ctx.response.headers.set("Content-Security-Policy", "default-src 'self'");
  ctx.response.headers.set("X-XSS-Protection", "1; mode=block");
  ctx.response.headers.set(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains",
  );

  // Remove server information
  ctx.response.headers.delete("Server");
});

// Logging middleware with enhanced security features
app.use(async (ctx, next) => {
  const start = Date.now();

  try {
    await next();
  } catch (err: unknown) {
    const error = err as { status?: number; message?: string };
    ctx.response.status = error.status || 500;
    const message = isProduction
      ? "An error occurred"
      : (error.message || "Unknown error");
    ctx.response.body = { success: false, message };
    logError(
      `Request processing: ${ctx.request.url.pathname}`,
      error,
    );
  }

  const ms = Date.now() - start;
  const status = ctx.response.status;
  const logMessage = `${
    new Date().toISOString()
  } - ${ctx.request.method} ${ctx.request.url} ${status} - ${ms}ms`;
  console.log(logMessage);

  if (status === 401 || status === 403) {
    console.warn(
      `Security alert: Unauthorized access attempt - ${ctx.request.method} ${ctx.request.url}`,
    );
  }
});

// Rate limiting middleware
const ipRequests = new Map<string, { count: number; resetTime: number }>();

app.use(async (ctx, next) => {
  const ip = ctx.request.ip;
  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15 minutes
  const maxRequests = isProduction ? 60 : 300;

  let record = ipRequests.get(ip);

  if (!record) {
    record = { count: 0, resetTime: now + windowMs };
    ipRequests.set(ip, record);
  }

  if (now > record.resetTime) {
    record.count = 0;
    record.resetTime = now + windowMs;
  }

  record.count++;

  if (record.count > maxRequests) {
    ctx.response.status = 429;
    ctx.response.body = {
      success: false,
      message: "Too many requests, please try again later",
    };
    return;
  }

  await next();
});

// Improved path sanitization in file access blocker
app.use(async (ctx, next) => {
  const path = ctx.request.url.pathname;

  // More comprehensive path blocking
  if (
    path.endsWith(".csv") ||
    path.includes("/data/") ||
    path.includes("..") ||
    /\/(\.git|\.env|node_modules)\//.test(path)
  ) {
    console.warn(`Blocked access to restricted path: ${path}`);
    ctx.response.status = 403;
    ctx.response.body = {
      success: false,
      message: "Access denied",
    };
    return;
  }

  await next();
});

// Enhanced session authentication middleware with session rotation
const authMiddleware = async (ctx, next) => {
  // Skip auth for login and health check endpoints
  if (
    ctx.request.url.pathname === "/api/login" ||
    ctx.request.url.pathname === "/api/health"
  ) {
    await next();
    return;
  }

  try {
    const authHeader = ctx.request.headers.get("Authorization");

    if (!authHeader || !authHeader.startsWith("Session ")) {
      ctx.response.status = 401;
      ctx.response.body = {
        success: false,
        message: "Unauthorized: No valid session provided",
      };
      return;
    }

    const sessionId = authHeader.split(" ")[1];
    const session = activeSessions.get(sessionId);

    if (!session) {
      ctx.response.status = 401;
      ctx.response.body = {
        success: false,
        message: "Unauthorized: Invalid or expired session",
      };
      return;
    }

    // Session rotation after 30 minutes for enhanced security
    const thirtyMinutes = 30 * 60 * 1000;
    if (Date.now() - session.lastActive > thirtyMinutes) {
      // Create new session ID and transfer data
      const newSessionId = generateSessionId();
      activeSessions.set(newSessionId, {
        username: session.username,
        lastActive: Date.now(),
      });

      // Delete old session
      activeSessions.delete(sessionId);

      // Add header for client to update session
      ctx.response.headers.set("X-New-Session-ID", newSessionId);
    } else {
      // Standard update of last active time
      session.lastActive = Date.now();
      activeSessions.set(sessionId, session);
    }

    ctx.state.user = session.username;
    await next();
  } catch (err) {
    ctx.response.status = 401;
    ctx.response.body = { success: false, message: "Authentication error" };
  }
};

// Setup CORS with appropriate security
app.use(oakCors({
  origin: (origin) => {
    // Allow requests with no origin (like mobile apps or direct requests)
    if (!origin) return true;

    // Check if origin matches allowed origins
    if (ALLOWED_ORIGINS.includes(origin)) {
      return true;
    }

    // In development, log rejected origins but allow them
    if (!isProduction) {
      console.log(
        `CORS request from: ${origin} - allowing in development mode`,
      );
      return true;
    }

    // In production, allow requests from same hostname but different ports
    try {
      const originUrl = new URL(origin);
      const hostnameMatch =
        originUrl.hostname === new URL(`http://${HOST}`).hostname;

      if (hostnameMatch) {
        return true;
      }
    } catch (err) {
      // URL parsing failed, reject
    }

    console.warn(`CORS rejected origin: ${origin}`);
    return false;
  },
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: [
    "Authorization",
    "Content-Type",
    "X-Requested-With",
    "Accept",
    "Origin",
  ],
  credentials: true,
  optionsSuccessStatus: 204,
  maxAge: 3600,
}));

// =========================================
// File System Setup & Functions
// =========================================

// Ensure data files exist
async function ensureDataFiles() {
  try {
    // Create the parent directories if they don't exist
    const studentDir = dirname(STUDENT_DATA_FILE);
    const attendanceDir = dirname(ATTENDANCE_FILE);

    try {
      await Deno.mkdir(studentDir, { recursive: true });
      await Deno.mkdir(attendanceDir, { recursive: true });
    } catch (err) {
      if (!(err instanceof Deno.errors.AlreadyExists)) {
        throw err;
      }
    }

    // Check if attendance file exists, create it if it doesn't
    if (!await exists(ATTENDANCE_FILE)) {
      const headers = [
        "Student ID",
        "First Name",
        "Last Name",
        "Year Of Study",
        "Degree Programme Title",
        "Mdx Email",
        "Mb Phone Number",
        "Nationality Description",
        "Day1",
        "Day2",
      ];
      await Deno.writeTextFile(ATTENDANCE_FILE, csvStringify([headers]));
      console.log(`Created ${ATTENDANCE_FILE}`);
    }

    // Ensure student data file exists
    if (!await exists(STUDENT_DATA_FILE)) {
      console.error(
        `Error: ${STUDENT_DATA_FILE} not found. Please create this file with student data.`,
      );
      return false;
    }

    return true;
  } catch (err) {
    console.error("Error setting up data files:", err);
    return false;
  }
}

// Add caching for student data to improve performance
const studentDataCache = {
  data: null as Map<string, any> | null,
  lastLoaded: 0,
  ttl: 5 * 60 * 1000, // 5 minutes
};

// Optimized version of readStudentData with caching
async function readStudentData() {
  try {
    const now = Date.now();

    // Return cached data if still valid
    if (
      studentDataCache.data &&
      (now - studentDataCache.lastLoaded < studentDataCache.ttl)
    ) {
      return studentDataCache.data;
    }

    const text = await Deno.readTextFile(STUDENT_DATA_FILE);
    const parsedData = csvParse(text, {
      skipFirstRow: true,
      columns: [
        "Student ID",
        "First Name",
        "Last Name",
        "Year Of Study",
        "Degree Programme Title",
        "Mdx Email",
        "Mb Phone Number",
        "Nationality Description",
      ],
    });

    const studentMap = new Map();
    for (const student of parsedData) {
      studentMap.set(student["Student ID"], student);
    }

    // Update cache
    studentDataCache.data = studentMap;
    studentDataCache.lastLoaded = now;

    return studentMap;
  } catch (err) {
    logError("Reading student data", err);
    throw new Error("Failed to read student data");
  }
}

// Read attendance data with error handling
async function readAttendanceData() {
  try {
    const text = await Deno.readTextFile(ATTENDANCE_FILE);
    const parsedData = csvParse(text, {
      skipFirstRow: true,
      columns: [
        "Student ID",
        "First Name",
        "Last Name",
        "Year Of Study",
        "Degree Programme Title",
        "Mdx Email",
        "Mb Phone Number",
        "Nationality Description",
        "Day1",
        "Day2",
      ],
    });

    const attendanceMap = new Map();
    for (const record of parsedData) {
      attendanceMap.set(record["Student ID"], record);
    }

    return attendanceMap;
  } catch (err) {
    logError("Reading attendance data", err);
    throw new Error("Failed to read attendance data");
  }
}

// Write attendance data to CSV with error handling
async function writeAttendanceData(
  attendanceMap: Map<string, Record<string, string>>,
) {
  try {
    const headers = [
      "Student ID",
      "First Name",
      "Last Name",
      "Year Of Study",
      "Degree Programme Title",
      "Mdx Email",
      "Mb Phone Number",
      "Nationality Description",
      "Day1",
      "Day2",
    ];

    const rows = [headers];
    for (const record of attendanceMap.values()) {
      rows.push(headers.map((header) => record[header] || ""));
    }

    // Write to a temporary file first, then rename to avoid data corruption
    const tempFile = `${ATTENDANCE_FILE}.temp`;
    await Deno.writeTextFile(tempFile, csvStringify(rows));
    await Deno.rename(tempFile, ATTENDANCE_FILE);
  } catch (err) {
    logError("Writing attendance data", err);
    throw new Error("Failed to save attendance data");
  }
}

// Validate Student ID format (M followed by 8 digits)
function isValidStudentId(studentId: string): boolean {
  return /^M\d{8}$/.test(studentId);
}

// Record attendance with error handling
async function recordAttendance(studentId: string, day: number) {
  try {
    // Input validation
    if (!studentId || typeof studentId !== "string") {
      return { success: false, message: "Invalid student ID" };
    }

    studentId = studentId.trim();

    if (!isValidStudentId(studentId)) {
      return {
        success: false,
        message: "Invalid Student ID format. Must be M followed by 8 digits.",
      };
    }

    if (day !== 1 && day !== 2) {
      return { success: false, message: "Day must be 1 or 2" };
    }

    // Load data
    const studentData = await readStudentData();
    const attendanceData = await readAttendanceData();

    // Verify student exists
    if (!studentData.has(studentId)) {
      return {
        success: false,
        message: `Student ID ${studentId} not found in database.`,
      };
    }

    const student = studentData.get(studentId);
    const timestamp = new Date().toISOString().replace("T", " ").substring(
      0,
      19,
    );
    const dayField = `Day${day}`;

    // Check if student already has attendance record
    if (attendanceData.has(studentId)) {
      const record = attendanceData.get(studentId);

      // Only update if day field is empty
      if (!record[dayField]) {
        record[dayField] = timestamp;
        attendanceData.set(studentId, record);
      } else {
        return {
          success: true,
          alreadyScanned: true,
          studentName: `${student["First Name"]} ${student["Last Name"]}`,
          message: `${student["First Name"]} ${
            student["Last Name"]
          } was already scanned for Day ${day} at ${record[dayField]}.`,
        };
      }
    } else {
      // Create new attendance record
      const newRecord = {
        ...student,
        Day1: day === 1 ? timestamp : "",
        Day2: day === 2 ? timestamp : "",
      };
      attendanceData.set(studentId, newRecord);
    }

    // Write updated attendance data to file
    await writeAttendanceData(attendanceData);

    return {
      success: true,
      alreadyScanned: false,
      studentName: `${student["First Name"]} ${student["Last Name"]}`,
      message: `Attendance recorded for ${student["First Name"]} ${
        student["Last Name"]
      } on Day ${day}.`,
    };
  } catch (error) {
    logError("Recording attendance", error);
    return {
      success: false,
      message: isProduction
        ? "Server error occurred while recording attendance"
        : `Server error: ${error.message}`,
    };
  }
}

// Clean up expired sessions (older than 8 hours)
function cleanupSessions() {
  const now = Date.now();
  const expiryTime = 8 * 60 * 60 * 1000; // 8 hours in ms

  for (const [sessionId, session] of activeSessions.entries()) {
    if (now - session.lastActive > expiryTime) {
      activeSessions.delete(sessionId);
    }
  }
}

// Run session cleanup every hour
setInterval(cleanupSessions, 60 * 60 * 1000);

// =========================================
// Routes
// =========================================

// Login endpoint
router.post(
  "/api/login",
  asyncHandler(async (ctx) => {
    try {
      console.log("Processing login request");
      const body = await ctx.request.body({ type: "json" }).value;

      if (!body || !body.username || !body.password) {
        ctx.response.status = 400;
        ctx.response.body = {
          success: false,
          message: "Username and password are required",
        };
        return;
      }

      console.log(`Login attempt for user: ${body.username}`);

      // Validate credentials
      if (body.username !== AUTH_USERNAME || body.password !== AUTH_PASSWORD) {
        console.log("Login failed: Invalid credentials");
        ctx.response.status = 401;
        ctx.response.body = { success: false, message: "Invalid credentials" };
        return;
      }

      // Create a new session
      const sessionId = generateSessionId();
      const expires = new Date();
      expires.setHours(expires.getHours() + 8); // 8 hours session

      activeSessions.set(sessionId, {
        username: AUTH_USERNAME,
        lastActive: Date.now(),
      });

      console.log("Login successful, session created");

      ctx.response.body = {
        success: true,
        sessionId,
        expiresAt: expires.toISOString(),
        user: { username: AUTH_USERNAME },
      };
    } catch (error) {
      logError("Login processing", error);
      ctx.response.status = 500;
      ctx.response.body = { success: false, message: "Server error" };
    }
  }),
);

// Logout endpoint
router.post(
  "/api/logout",
  authMiddleware,
  asyncHandler(async (ctx) => {
    const authHeader = ctx.request.headers.get("Authorization");
    if (authHeader && authHeader.startsWith("Session ")) {
      const sessionId = authHeader.split(" ")[1];
      activeSessions.delete(sessionId);
      ctx.response.body = { success: true, message: "Logged out successfully" };
    } else {
      ctx.response.status = 400;
      ctx.response.body = { success: false, message: "No session provided" };
    }
  }),
);

// Attendance recording endpoint
router.post(
  "/api/attendance",
  authMiddleware,
  asyncHandler(async (ctx) => {
    const body = await ctx.request.body({ type: "json" }).value;

    if (!body || !body.studentId) {
      ctx.response.status = 400;
      ctx.response.body = { success: false, message: "Student ID is required" };
      return;
    }

    const result = await recordAttendance(
      body.studentId,
      Number(body.day) || 1,
    );
    ctx.response.body = result;
  }),
);

// Export attendance endpoint with password protection
router.post(
  "/api/export",
  authMiddleware,
  asyncHandler(async (ctx) => {
    try {
      const body = await ctx.request.body({ type: "json" }).value;
      const exportPassword = Deno.env.get("EXPORT_PASSWORD");
      
      // Verify the export password
      if (!body || !body.password || body.password !== exportPassword) {
        ctx.response.status = 403;
        ctx.response.body = {
          success: false,
          message: "Invalid export password"
        };
        return;
      }
      
      // Read the attendance data
      const attendanceFile = await Deno.readTextFile(ATTENDANCE_FILE);
      
      // Set appropriate headers for CSV download
      ctx.response.headers.set("Content-Type", "text/csv");
      ctx.response.headers.set(
        "Content-Disposition", 
        `attachment; filename="mdx_attendance_${new Date().toISOString().split('T')[0]}.csv"`
      );
      
      // Return the raw CSV data
      ctx.response.body = attendanceFile;
    } catch (error) {
      logError("Exporting attendance", error);
      ctx.response.status = 500;
      ctx.response.body = {
        success: false,
        message: isProduction 
          ? "Failed to export attendance data"
          : `Export error: ${error.message}`,
      };
    }
  }),
);

// Health check endpoint
router.get("/api/health", (ctx) => {
  ctx.response.body = {
    status: "ok",
    timestamp: new Date().toISOString(),
    environment: ENVIRONMENT,
  };
});

// =========================================
// Server Startup
// =========================================

app.use(router.routes());
app.use(router.allowedMethods());

// Add graceful shutdown handling
function setupGracefulShutdown(app) {
  const handler = async () => {
    console.log("Shutting down server gracefully...");

    // Allow time for current requests to complete
    setTimeout(() => {
      console.log("Server shutdown complete");
      Deno.exit(0);
    }, 3000);
  };

  Deno.addSignalListener("SIGINT", handler);
  Deno.addSignalListener("SIGTERM", handler);
}

// Start function to properly handle startup
async function startServer() {
  console.log(`Starting server in ${ENVIRONMENT} environment...`);

  // Check required files
  const filesOk = await ensureDataFiles();
  if (!filesOk) {
    console.error("Error: Failed to ensure required data files exist.");
    Deno.exit(1);
  }

  try {
    setupGracefulShutdown(app);
    console.log(`Server listening on ${HOST}:${PORT}`);
    await app.listen({ hostname: HOST, port: PORT });
  } catch (err) {
    console.error("Failed to start server:", err);
    Deno.exit(1);
  }
}

// Start the server
await startServer();
