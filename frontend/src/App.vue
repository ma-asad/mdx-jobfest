<template>
  <div class="min-h-screen bg-gray-100 p-4 flex items-center justify-center">
    <!-- Main content with side-by-side layout for larger screens -->
    <div class="max-w-5xl w-full flex flex-col lg:flex-row gap-4">
      <!-- Left column: Main app card -->
      <div class="bg-white rounded-xl shadow-md overflow-hidden p-6 lg:flex-1">
        <!-- Header with Logo and Title - visible only on mobile -->
        <div class="flex flex-col items-center mb-6 lg:hidden">
          <img
            src="/assets/mdx-logo.png"
            alt="Middlesex University Logo"
            class="h-12 mb-3"
          />
          <h1 class="text-2xl font-bold text-center text-red-700">
            MDX JOB FEST
          </h1>
        </div>

        <!-- Login screen -->
        <LoginForm
          v-if="!isLoggedIn"
          :server-url="serverUrl"
          @login-success="handleLoginSuccess"
        />

        <!-- Main app content when logged in -->
        <div v-else>
          <!-- Day selection -->
          <div class="mb-6">
            <label class="block text-gray-700 text-sm font-bold mb-2">
              Select Day:
            </label>
            <div class="flex space-x-4">
              <button
                @click="selectedDay = 1"
                class="px-4 py-2 rounded-md"
                :class="
                  selectedDay === 1
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-200 text-gray-700'
                "
              >
                Day 1
              </button>
              <button
                @click="selectedDay = 2"
                class="px-4 py-2 rounded-md"
                :class="
                  selectedDay === 2
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-200 text-gray-700'
                "
              >
                Day 2
              </button>
            </div>
          </div>
          
          <!-- Scanner or Manual Entry selector with Export button -->
          <div class="mb-6">
            <div class="flex flex-wrap gap-2">
              <button
                @click="activeMode = 'scan'"
                class="px-4 py-2 rounded-md"
                :class="
                  activeMode === 'scan'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-200 text-gray-700'
                "
              >
                Scan Barcode
              </button>
              <button
                @click="activeMode = 'manual'"
                class="px-4 py-2 rounded-md"
                :class="
                  activeMode === 'manual'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-200 text-gray-700'
                "
              >
                Manual Entry
              </button>
              <button
                @click="exportAttendance"
                class="px-4 py-2 rounded-md bg-green-600 hover:bg-green-700 text-white"
                :disabled="isExporting"
              >
                <span v-if="isExporting">Exporting...</span>
                <span v-else class="flex items-center">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="h-5 w-5 mr-1"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                    />
                  </svg>
                  Export
                </span>
              </button>
            </div>
          </div>

          <!-- Scanner component -->
          <ScannerView
            v-if="activeMode === 'scan'"
            :selected-day="selectedDay"
            @code-scanned="handleCodeScanned"
            @scan-error="handleScanError"
          />

          <!-- Manual entry component -->
          <ManualEntry
            v-else
            :selected-day="selectedDay"
            @submit="handleManualSubmit"
          />

          <!-- Status messages -->
          <div
            v-if="statusMessage"
            :class="statusClass"
            class="mt-6 p-4 rounded-md"
          >
            <div class="font-bold mb-1">{{ statusTitle }}</div>
            <div>{{ statusMessage }}</div>
          </div>

          <!-- Server status and user info -->
          <div
            class="mt-6 flex justify-between items-center text-sm text-gray-600"
          >
            <div class="flex items-center">
              <div
                class="w-3 h-3 rounded-full mr-2"
                :class="serverConnected ? 'bg-green-500' : 'bg-red-500'"
              ></div>
              <span
                >Server:
                {{ serverConnected ? "Connected" : "Disconnected" }}</span
              >
            </div>

            <!-- User info and logout -->
            <div class="flex items-center">
              <span class="mr-2">User: {{ username }}</span>
              <button
                @click="logout"
                class="text-red-600 hover:text-red-800 underline text-xs"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Right column: Logo, title, developer info & metadata for larger screens -->
      <div class="lg:w-64 flex flex-col gap-4">
        <!-- Logo and Title - visible only on desktop -->
        <div
          class="bg-white rounded-xl shadow-md p-6 hidden lg:flex lg:flex-col items-center"
        >
          <img
            src="/assets/mdx-logo.png"
            alt="Middlesex University Logo"
            class="h-16 mb-3"
          />
          <h1 class="text-xl font-bold text-center text-red-700">
            MDX JOB FEST
          </h1>
        </div>

        <!-- Developer attribution card -->
        <div
          class="bg-indigo-50 rounded-xl shadow-md p-6 flex flex-col items-center justify-center"
        >
          <div class="text-center">
            <div class="font-medium text-indigo-800 mb-2">Developed by</div>
            <div class="text-lg font-bold text-indigo-900 mb-3">
              Mohammad Asad Atterkhan
            </div>
            <img
              src="https://github.com/ma-asad.png"
              alt="Developer"
              class="w-20 h-20 rounded-full mx-auto mb-3 shadow-md"
              onerror="this.src='/assets/me.png'; this.onerror=null;"
            />
            <a
              href="https://ma-asad.github.io/"
              target="_blank"
              class="inline-flex items-center text-indigo-600 hover:text-indigo-800 hover:underline mt-2"
            >
              <span>ma-asad.github.io</span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-4 w-4 ml-1"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </div>
  </div>
  
  <!-- Export password modal -->
  <div
    v-if="showExportPasswordModal"
    class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
  >
    <div class="bg-white rounded-lg p-6 shadow-xl max-w-md w-full">
      <h3 class="text-lg font-medium text-gray-900 mb-4">
        Export Authentication
      </h3>
      <p class="mb-4 text-gray-600">
        Please enter the export password to download attendance data.
      </p>

      <div class="mb-4">
        <label
          class="block text-gray-700 text-sm font-bold mb-2"
          for="export-password"
        >
          Export Password
        </label>
        <input
          id="export-password"
          v-model="exportPassword"
          type="password"
          class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
          placeholder="Enter export password"
          @keyup.enter="confirmExport"
        />
      </div>

      <div v-if="exportPasswordError" class="mb-4 text-red-500 text-sm">
        {{ exportPasswordError }}
      </div>

      <div class="flex justify-end">
        <button
          @click="showExportPasswordModal = false"
          class="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded mr-2"
        >
          Cancel
        </button>
        <button
          @click="confirmExport"
          class="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
          :disabled="isConfirmingExport"
        >
          <span v-if="isConfirmingExport">Verifying...</span>
          <span v-else>Confirm</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, computed } from "vue";
import ScannerView from "./components/ScannerView.vue";
import ManualEntry from "./components/ManualEntry.vue";
import LoginForm from "./components/LoginForm.vue";

export default {
  components: {
    ScannerView,
    ManualEntry,
    LoginForm,
  },
  setup() {
    const activeMode = ref("scan");
    const selectedDay = ref(1);
    const serverConnected = ref(false);
    const statusMessage = ref("");
    const statusClass = ref("bg-gray-100 text-gray-700");
    const statusTitle = ref("");
    const isLoggedIn = ref(false);
    const username = ref("");
    // For export functionality
    const isExporting = ref(false);
    // Add these with your other ref() declarations
    const showExportPasswordModal = ref(false);
    const exportPassword = ref("");
    const exportPasswordError = ref("");
    const isConfirmingExport = ref(false);

    // Replace the existing server URL determination code in App.vue
    const serverUrl = ref("");
    const networkStatus = ref("detecting");

    // Improved server URL determination function
    const determineServerUrl = async () => {
      networkStatus.value = "detecting";
      console.log("Determining best server URL...");

      // Define possible server URLs to try
      const possibleUrls = [];

      // 1. Try environment variable first
      if (import.meta.env.VITE_SERVER_URL) {
        possibleUrls.push(import.meta.env.VITE_SERVER_URL);
      }

      // 2. Try current hostname with port 8000
      possibleUrls.push(`http://${window.location.hostname}:8000`);

      // 3. Try localhost if we're on the host machine
      if (
        window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1"
      ) {
        // We're likely on the host, move localhost to the top of the list
        possibleUrls.unshift("http://localhost:8000");
      } else {
        // We're on a separate device, add localhost as a fallback
        possibleUrls.push("http://localhost:8000");
      }

      // 4. Try common local network patterns as last resort
      if (!possibleUrls.some((url) => url.includes("192.168."))) {
        possibleUrls.push("http://192.168.3.56:8000");
      }

      console.log(`URLs to try: ${possibleUrls.join(", ")}`);

      // Test all URLs and use the first working one
      for (const url of possibleUrls) {
        try {
          console.log(`Testing connection to: ${url}`);
          const response = await fetch(`${url}/api/health`, {
            method: "GET",
            headers: { "Content-Type": "application/json" },
            signal: AbortSignal.timeout(2500), // 2.5 second timeout
          });

          if (response.ok) {
            console.log(`✅ Successfully connected to: ${url}`);
            serverUrl.value = url;
            serverConnected.value = true;
            networkStatus.value = "connected";
            return true;
          }
        } catch (err) {
          console.log(`❌ Failed to connect to ${url}: ${err.message}`);
        }
      }

      console.log("❌ Could not connect to any server URL");
      networkStatus.value = "disconnected";
      serverConnected.value = false;
      return false;
    };

    const checkAuthStatus = () => {
      const sessionId = localStorage.getItem("sessionId");
      const expiry = localStorage.getItem("sessionExpiry");

      if (sessionId && expiry) {
        // Check if session is expired
        if (new Date(expiry) > new Date()) {
          isLoggedIn.value = true;
          username.value = localStorage.getItem("username") || "admin";
        } else {
          // Session expired, remove it
          logout();
        }
      }
    };

    // Handle successful login
    const handleLoginSuccess = () => {
      isLoggedIn.value = true;
      username.value = localStorage.getItem("username") || "admin";
      checkServerConnection();
    };

    // Logout function
    const logout = async () => {
      const sessionId = localStorage.getItem("sessionId");

      if (sessionId) {
        try {
          // Call logout endpoint
          await fetch(`${serverUrl.value}/api/logout`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Session ${sessionId}`,
            },
          });
        } catch (err) {
          console.error("Logout error:", err);
        }
      }

      localStorage.removeItem("sessionId");
      localStorage.removeItem("sessionExpiry");
      localStorage.removeItem("username");
      isLoggedIn.value = false;
      username.value = "";
    };

    // Check server connection with fallback support
    const checkServerConnection = async () => {
      let connected = false;

      // Try the main server URL first
      try {
        console.log(
          `Checking connection to primary server: ${serverUrl.value}`
        );
        const response = await fetch(`${serverUrl.value}/api/health`, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          signal: AbortSignal.timeout(5000), // 5 second timeout
        });

        if (response.ok) {
          console.log("Primary server connection successful");
          serverConnected.value = true;
          connected = true;
        } else {
          console.log(`Primary server returned ${response.status}`);
        }
      } catch (error) {
        console.error(`Primary server connection failed: ${error.message}`);
      }

      // If primary connection failed, try to determine a new server URL
      if (!connected) {
        await determineServerUrl();
      }

      // If all connection attempts failed
      if (!serverConnected.value) {
        showError(
          "Server Error",
          "Could not connect to the server on any available address."
        );
        return false;
      }

      return true;
    };

    // Handle barcode scan
    const handleCodeScanned = async (studentId) => {
      if (!serverConnected.value) {
        showError(
          "Server Error",
          "Server is not connected. Please check the connection."
        );
        return;
      }

      try {
        await submitAttendance(studentId);
      } catch (error) {
        console.error("Error submitting attendance:", error);
        showError("Error", "Failed to submit attendance. Please try again.");
      }
    };

    // Handle manual entry submit
    const handleManualSubmit = async (studentId) => {
      if (!serverConnected.value) {
        showError(
          "Server Error",
          "Server is not connected. Please check the connection."
        );
        return;
      }

      try {
        await submitAttendance(studentId);
      } catch (error) {
        console.error("Error submitting attendance:", error);
        showError("Error", "Failed to submit attendance. Please try again.");
      }
    };

    // Handle scan errors
    const handleScanError = (error) => {
      console.error("Scan error:", error);
      showError("Scan Error", error);
    };

    // Submit attendance to the server with improved error handling
    const submitAttendance = async (studentId) => {
      try {
        const sessionId = localStorage.getItem("sessionId");

        if (!sessionId) {
          isLoggedIn.value = false;
          showError(
            "Authentication Error",
            "You are not logged in. Please login again."
          );
          return;
        }

        console.log(
          `Submitting attendance to ${serverUrl.value}/api/attendance`
        );

        const response = await fetch(`${serverUrl.value}/api/attendance`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Session ${sessionId}`,
          },
          body: JSON.stringify({
            studentId,
            day: selectedDay.value,
          }),
        });

        if (response.status === 401) {
          isLoggedIn.value = false;
          showError(
            "Authentication Error",
            "Your session has expired. Please login again."
          );
          return;
        }

        const data = await response.json();
        console.log("Attendance response:", data);

        if (data.success) {
          if (data.alreadyScanned) {
            showWarning("Already Scanned", data.message);
          } else {
            showSuccess("Success", data.message);
          }
        } else {
          showError("Error", data.message);
        }
      } catch (error) {
        console.error("Submit error:", error);

        // Try reconnecting to the server if the request fails
        await checkServerConnection();

        if (serverConnected.value) {
          showError(
            "Connection Error",
            "Failed to submit attendance. The connection was restored, please try again."
          );
        } else {
          showError(
            "Server Error",
            "Failed to connect to the server. Please check your network connection."
          );
        }
      }
    };

    // Export attendance data - modified to prompt for password first
    const exportAttendance = async () => {
      if (!serverConnected.value || !isLoggedIn.value) {
        showError(
          "Export Error",
          "Cannot export data. Please check server connection and login status."
        );
        return;
      }

      // Reset state and show modal
      exportPassword.value = "";
      exportPasswordError.value = "";
      showExportPasswordModal.value = true;
    };

    // Function to handle export confirmation with password
    const confirmExport = async () => {
      if (!exportPassword.value) {
        exportPasswordError.value = "Password is required";
        return;
      }

      try {
        isConfirmingExport.value = true;
        const sessionId = localStorage.getItem("sessionId");

        const response = await fetch(`${serverUrl.value}/api/export`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Session ${sessionId}`,
          },
          body: JSON.stringify({
            password: exportPassword.value,
          }),
        });

        if (response.status === 401) {
          isLoggedIn.value = false;
          showError(
            "Authentication Error",
            "Your session has expired. Please login again."
          );
          showExportPasswordModal.value = false;
          return;
        }

        if (response.status === 403) {
          exportPasswordError.value = "Invalid export password";
          return;
        }

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(
            errorData.message || "Failed to export attendance data"
          );
        }

        // Get the filename from the Content-Disposition header or use a default
        const contentDisposition = response.headers.get("Content-Disposition");
        let filename = "attendance-export.csv";
        if (contentDisposition) {
          const filenameMatch = contentDisposition.match(/filename="(.+)"/);
          if (filenameMatch && filenameMatch[1]) {
            filename = filenameMatch[1];
          }
        }

        // Download the file
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.style.display = "none";
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);

        showExportPasswordModal.value = false;
        showSuccess(
          "Export Successful",
          "Attendance data has been exported successfully."
        );
      } catch (error) {
        console.error("Export error:", error);
        showError(
          "Export Error",
          error.message || "Failed to export attendance data"
        );
        showExportPasswordModal.value = false;
      } finally {
        isConfirmingExport.value = false;
      }
    };

    // Display success message
    const showSuccess = (title, message) => {
      statusTitle.value = title;
      statusMessage.value = message;
      statusClass.value = "bg-green-100 text-green-800";
      setTimeout(() => {
        statusMessage.value = "";
      }, 5000);
    };

    // Display warning message
    const showWarning = (title, message) => {
      statusTitle.value = title;
      statusMessage.value = message;
      statusClass.value = "bg-yellow-100 text-yellow-800";
      setTimeout(() => {
        statusMessage.value = "";
      }, 5000);
    };

    // Display error message
    const showError = (title, message) => {
      statusTitle.value = title;
      statusMessage.value = message;
      statusClass.value = "bg-red-100 text-red-800";
      setTimeout(() => {
        statusMessage.value = "";
      }, 5000);
    };

    // Check authentication status and server connection on mount
    onMounted(async () => {
      // First try to determine the best server URL
      const connected = await determineServerUrl();

      // If we connected successfully, check authentication status
      if (connected) {
        checkAuthStatus();
      } else {
        // Show friendly error message with retry button
        showError(
          "Server Connection Error",
          "Could not connect to the attendance server. Is the server running?"
        );
      }

      // Set up periodic connection check
      setInterval(async () => {
        // Only check if logged in or trying to log in
        if (isLoggedIn.value || networkStatus.value === "disconnected") {
          // Check our current server URL first
          try {
            const response = await fetch(`${serverUrl.value}/api/health`, {
              signal: AbortSignal.timeout(2000),
            });
            if (response.ok) {
              serverConnected.value = true;
              networkStatus.value = "connected";
            } else {
              // If our current URL fails, try to find a new one
              await determineServerUrl();
            }
          } catch (err) {
            console.log(
              "Connection check failed, trying to find a new server..."
            );
            await determineServerUrl();
          }
        }
      }, 30000); // Check every 30 seconds
    });

    return {
      activeMode,
      selectedDay,
      serverConnected,
      statusMessage,
      statusClass,
      statusTitle,
      isLoggedIn,
      username,
      serverUrl,
      handleCodeScanned,
      handleManualSubmit,
      handleScanError,
      handleLoginSuccess,
      logout,
      exportAttendance,
      isExporting,
      // Add these new variables
      showExportPasswordModal,
      exportPassword,
      exportPasswordError,
      isConfirmingExport,
      confirmExport,
    };
  },
};
</script>
