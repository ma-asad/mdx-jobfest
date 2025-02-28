<template>
  <div class="scanner-container">
    <!-- Error message if camera access fails -->
    <div
      v-if="cameraError"
      class="bg-red-100 text-red-800 p-4 rounded-md mb-4 shadow-sm"
    >
      <div class="font-bold text-lg mb-1">Camera Error</div>
      <div>{{ cameraError }}</div>
      <button
        @click="initScanner"
        class="mt-3 bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors shadow-sm"
      >
        Try Again
      </button>
    </div>

    <!-- Quagga scanner viewfinder -->
    <div v-else class="relative overflow-hidden rounded-lg shadow-md">
      <div id="scanner-container" class="w-full h-72 bg-gray-900"></div>

      <!-- Status indicator -->
      <div
        class="absolute top-2 right-2 px-2 py-1 rounded-full text-xs text-white"
        :class="isScanning ? 'bg-green-500' : 'bg-red-500'"
      >
        {{ isScanning ? "Scanning" : "Stopped" }}
      </div>

      <!-- Scan results display (now at top left) -->
      <div
        v-if="lastScannedCode"
        class="absolute top-2 left-2 bg-black bg-opacity-70 px-3 py-2 rounded-md text-sm text-white max-w-[70%] truncate"
      >
        <span class="font-medium">Scanned: </span>{{ lastScannedCode }}
      </div>

      <!-- User guidance -->
      <div
        class="absolute bottom-2 left-2 right-2 bg-white bg-opacity-90 p-2 rounded-md text-center shadow-sm"
      >
        <p class="text-sm text-gray-800">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="inline-block h-4 w-4 mr-1"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fill-rule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2h-1V9a1 1 0 00-1-1z"
              clip-rule="evenodd"
            />
          </svg>
          Ensure good lighting and hold barcode horizontally
        </p>
      </div>

      <!-- Scanning overlay -->
      <div
        class="absolute inset-0 flex items-center justify-center pointer-events-none"
      >
        <div
          class="border-2 border-indigo-500 w-80 h-16 opacity-70 flex items-center justify-center"
          :class="{ 'animate-pulse': isScanning && !isPaused }"
        >
          <div
            v-if="isPaused"
            class="bg-white bg-opacity-90 p-3 rounded-md shadow-sm"
          >
            <p class="text-center text-indigo-800 font-medium">Processing...</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Scanner controls -->
    <div class="mt-4 flex justify-between">
      <button
        v-if="isScanning"
        @click="stopScanner"
        class="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors shadow-sm flex items-center"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-5 w-5 mr-1"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fill-rule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z"
            clip-rule="evenodd"
          />
        </svg>
        Stop Scanner
      </button>
      <button
        v-else
        @click="initScanner"
        class="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors shadow-sm flex items-center"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-5 w-5 mr-1"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fill-rule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
            clip-rule="evenodd"
          />
        </svg>
        Start Scanner
      </button>

      <!-- Camera selection (for devices with multiple cameras) -->
      <select
        v-if="cameras.length > 1"
        v-model="selectedCamera"
        @change="changeCamera"
        class="bg-white border border-gray-300 px-3 py-2 rounded-md shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
      >
        <option
          v-for="camera in cameras"
          :key="camera.deviceId"
          :value="camera.deviceId"
        >
          {{ camera.label || `Camera ${camera.deviceId.slice(0, 4)}` }}
        </option>
      </select>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted } from "vue";
import Quagga from "@ericblade/quagga2";

export default {
  props: {
    selectedDay: {
      type: Number,
      required: true,
    },
  },
  emits: ["code-scanned", "scan-error"],
  setup(props, { emit }) {
    const isScanning = ref(false);
    const isPaused = ref(false);
    const cameraError = ref("");
    const cameras = ref([]);
    const selectedCamera = ref("");
    const lastScannedCode = ref(""); // To display the last scanned code

    // Check if student ID matches the required format (M followed by 8 digits)
    const isValidStudentId = (id) => {
      return /^M\d{8}$/i.test(id);
    };

    // List available cameras
    const listCameras = async () => {
      try {
        // Request permission first
        try {
          const initialStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
          initialStream.getTracks().forEach((track) => track.stop());
        } catch (err) {
          console.log("Could not get initial camera permission");
        }

        const devices = await navigator.mediaDevices.enumerateDevices();
        cameras.value = devices.filter(
          (device) => device.kind === "videoinput"
        );

        if (cameras.value.length > 0 && !selectedCamera.value) {
          // Prefer back camera on mobile devices if available
          const backCamera = cameras.value.find(
            (camera) =>
              camera.label &&
              (camera.label.toLowerCase().includes("back") ||
                camera.label.toLowerCase().includes("rear"))
          );

          selectedCamera.value = backCamera
            ? backCamera.deviceId
            : cameras.value[0].deviceId;
        }
      } catch (error) {
        console.error("Error listing cameras:", error);
      }
    };

    // Initialize scanner using Quagga
    const initScanner = async () => {
      try {
        cameraError.value = "";
        isPaused.value = false;

        // Check for camera API support
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error("Camera API is not available in your browser");
        }

        // Make sure the scanner container exists before initializing
        const scannerContainer = document.getElementById("scanner-container");
        if (!scannerContainer) {
          throw new Error("Scanner container element not found");
        }

        // Configure scanner for optimal barcode scanning
        const scannerWidth =
          window.innerWidth < 600 ? window.innerWidth - 40 : 640;
        const scannerHeight = window.innerWidth < 600 ? 240 : 360;

        // Test camera access first to ensure permissions
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: "environment",
              width: { ideal: scannerWidth },
              height: { ideal: scannerHeight },
            },
          });

          // Stop this test stream immediately
          stream.getTracks().forEach((track) => track.stop());
        } catch (err) {
          console.error("Camera permission test failed:", err);
          throw new Error(`Camera permission denied: ${err.message}`);
        }

        // Configure Quagga
        let constraints = {
          width: { min: 640 },
          height: { min: 480 },
          aspectRatio: { min: 1, max: 2 },
          facingMode: "environment", // Use back camera
        };

        // Use specific camera if selected
        if (selectedCamera.value) {
          constraints = {
            ...constraints,
            deviceId: { exact: selectedCamera.value },
          };
        }

        // Initialize Quagga with optimized settings for mobile devices
        await Quagga.init(
          {
            inputStream: {
              name: "Live",
              type: "LiveStream",
              target: scannerContainer,
              constraints: constraints,
              area: {
                // Focus on center of view where barcode is likely to be
                top: "20%",
                right: "10%",
                left: "10%",
                bottom: "20%",
              },
            },
            locator: {
              patchSize: "medium",
              halfSample: true,
            },
            // Reduce workers for mobile devices
            numOfWorkers: navigator.hardwareConcurrency
              ? Math.max(1, Math.min(navigator.hardwareConcurrency - 1, 4))
              : 1,
            frequency: 10,
            decoder: {
              readers: [
                "code_39_reader", // Priority - common for student IDs
                "code_128_reader",
                "ean_reader",
                "ean_8_reader",
                "codabar_reader",
                "upc_reader",
                "upc_e_reader",
                "i2of5_reader",
              ],
              multiple: false,
              debug: false, // Disable debug flag for production
            },
            locate: true,
          },
          function (err) {
            if (err) {
              console.error("Quagga initialization error:", err);
              cameraError.value = `Could not start scanner: ${err.message}`;
              isScanning.value = false;
              emit("scan-error", `Could not start scanner: ${err.message}`);
              return;
            }

            console.log("Quagga initialized successfully");
            // Start scanning
            Quagga.start();
            isScanning.value = true;

            // Set up processing callbacks
            Quagga.onDetected(processBarcode);

            // Add visualization for detected barcodes
            Quagga.onProcessed(function (result) {
              const drawingCtx = Quagga.canvas.ctx.overlay;
              const drawingCanvas = Quagga.canvas.dom.overlay;

              if (result) {
                if (result.boxes) {
                  drawingCtx.clearRect(
                    0,
                    0,
                    drawingCanvas.width,
                    drawingCanvas.height
                  );
                  result.boxes.forEach((box) => {
                    if (box !== result.box) {
                      drawingCtx.strokeStyle = "rgba(0, 255, 0, 0.5)";
                      drawingCtx.lineWidth = 2;
                      drawingCtx.strokeRect(
                        box[0],
                        box[1],
                        box[2] - box[0],
                        box[3] - box[1]
                      );
                    }
                  });
                }

                if (result.box) {
                  drawingCtx.strokeStyle = "rgba(0, 0, 255, 0.8)";
                  drawingCtx.lineWidth = 2;
                  drawingCtx.strokeRect(
                    result.box.x,
                    result.box.y,
                    result.box.width,
                    result.box.height
                  );
                }

                if (result.codeResult && result.codeResult.code) {
                  // Update the scanned code display at top left instead
                  lastScannedCode.value = result.codeResult.code;
                }
              }
            });
          }
        );
      } catch (error) {
        cameraError.value = `Could not access the camera: ${error.message}. Please grant permission and try again.`;
        isScanning.value = false;
        emit("scan-error", `Could not access the camera: ${error.message}`);
      }
    };

    // Process scanned barcode
    const processBarcode = (result) => {
      if (isPaused.value) return; // Avoid multiple scans

      isPaused.value = true;
      const scannedText = result.codeResult.code.trim();
      processScannedCode(scannedText);

      // Wait before scanning again to prevent duplicates - now set to 1 second
      setTimeout(() => {
        isPaused.value = false;
      }, 1000); // Changed to 1000ms (1 second) from 3000ms
    };

    // Process a scanned barcode
    const processScannedCode = (scannedText) => {
      // Display the raw scanned code
      lastScannedCode.value = scannedText;

      // Try multiple cleanup approaches to identify student ID

      // 1. Try to find M followed by 8 digits anywhere in the string
      const studentIdMatch = scannedText.match(/M\d{8}/i);

      // 2. If not found, look for just 8-9 digits that might be the ID without the M
      const digitOnlyMatch = !studentIdMatch
        ? scannedText.match(/\d{8,9}/)
        : null;

      // 3. Clean up any common prefixes/suffixes from barcode standards
      let cleanText = scannedText
        .trim()
        .replace(/^\[/g, "") // Some barcode readers add brackets
        .replace(/\]$/g, "")
        .replace(/[\r\n\t]/g, ""); // Remove any whitespace chars

      let studentId;

      if (studentIdMatch) {
        // Found a pattern that matches M + 8 digits
        studentId = studentIdMatch[0].toUpperCase();
      } else if (digitOnlyMatch) {
        // If we just have digits, assume we need to add M
        studentId = "M" + digitOnlyMatch[0];
      } else {
        // Last resort - use cleaned text
        studentId = cleanText;
      }

      // Final validation
      if (isValidStudentId(studentId)) {
        emit("code-scanned", studentId);
      } else {
        emit(
          "scan-error",
          `Invalid Student ID format: ${studentId}. Must be M followed by 8 digits.`
        );
      }
    };

    // Stop scanner
    const stopScanner = () => {
      if (isScanning.value) {
        Quagga.offDetected(processBarcode);
        Quagga.offProcessed();
        Quagga.stop();
        isScanning.value = false;
        lastScannedCode.value = ""; // Clear the last scanned code
      }
    };

    // Change camera
    const changeCamera = () => {
      stopScanner();
      setTimeout(() => {
        initScanner();
      }, 500);
    };

    // Initialize on component mount
    onMounted(() => {
      listCameras();

      // Allow a moment for the DOM to be ready
      setTimeout(() => {
        initScanner();
      }, 500);
    });

    // Clean up on component destruction
    onUnmounted(() => {
      stopScanner();
    });

    return {
      isScanning,
      isPaused,
      cameraError,
      cameras,
      selectedCamera,
      lastScannedCode,
      initScanner,
      stopScanner,
      changeCamera,
    };
  },
};
</script>

<style scoped>
/* Style the Quagga viewfinder overlay */
#scanner-container {
  position: relative;
  overflow: hidden;
  background: linear-gradient(to bottom, #1a1a1a, #000000);
}

/* This positions the video properly */
#scanner-container video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* Style the canvas overlays generated by Quagga */
#scanner-container canvas {
  position: absolute;
  top: 0;
  left: 0;
}

/* Make sure drawingCanvas is displayed on top */
#scanner-container canvas.drawingCanvas {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 10;
}

/* Animation for the scanning box */
@keyframes pulse {
  0% {
    border-color: rgba(79, 70, 229, 0.7);
    box-shadow: 0 0 0 0 rgba(79, 70, 229, 0.7);
  }

  70% {
    border-color: rgba(79, 70, 229, 0);
    box-shadow: 0 0 0 10px rgba(79, 70, 229, 0);
  }

  100% {
    border-color: rgba(79, 70, 229, 0);
    box-shadow: 0 0 0 0 rgba(79, 70, 229, 0);
  }
}

.animate-pulse {
  animation: pulse 2s infinite;
}
</style>
