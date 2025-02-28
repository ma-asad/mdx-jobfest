<template>
  <div class="login-container">
    <h2 class="text-xl font-bold mb-4">Admin Login</h2>

    <div v-if="error" class="bg-red-100 text-red-800 p-3 rounded-md mb-4">
      {{ error }}
    </div>

    <form @submit.prevent="handleLogin">
      <div class="mb-4">
        <label
          class="block text-gray-700 text-sm font-bold mb-2"
          for="username"
        >
          Username
        </label>
        <input
          id="username"
          v-model="username"
          type="text"
          class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
          placeholder="Username"
          required
        />
      </div>

      <div class="mb-6">
        <label
          class="block text-gray-700 text-sm font-bold mb-2"
          for="password"
        >
          Password
        </label>
        <input
          id="password"
          v-model="password"
          type="password"
          class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 mb-3 leading-tight focus:outline-none focus:shadow-outline"
          placeholder="******************"
          required
        />
      </div>

      <div class="flex items-center justify-between">
        <button
          class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline w-full"
          :disabled="isLoading"
          type="submit"
        >
          <span v-if="isLoading">Logging in...</span>
          <span v-else>Sign In</span>
        </button>
      </div>
    </form>
  </div>
</template>

<script>
import { ref } from "vue";

export default {
  emits: ["login-success"],
  props: {
    serverUrl: {
      type: String,
      required: true,
    },
  },
  setup(props, { emit }) {
    const username = ref("");
    const password = ref("");
    const error = ref("");
    const isLoading = ref(false);

    const handleLogin = async () => {
      try {
        isLoading.value = true;
        error.value = "";

        console.log(
          `Attempting to connect to server at: ${props.serverUrl}/api/login`
        );

        // Add timeout to the fetch request
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

        const response = await fetch(`${props.serverUrl}/api/login`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            username: username.value,
            password: password.value,
          }),
          signal: controller.signal,
          // Add credentials mode
          credentials: "include",
          mode: "cors",
        });

        clearTimeout(timeoutId);

        console.log(`Login response status: ${response.status}`);

        const data = await response.json();
        console.log(
          "Login response received:",
          data.success ? "Success" : "Failure"
        );

        if (data.success) {
          // Store token in localStorage with consistent key names
          localStorage.setItem("sessionId", data.sessionId);
          localStorage.setItem("sessionExpiry", data.expiresAt);
          localStorage.setItem("username", data.user.username);

          // Notify parent component
          emit("login-success");
        } else {
          error.value =
            data.message || "Login failed. Please check your credentials.";
          console.error("Login error details:", data);
        }
      } catch (err) {
        console.error("Login error:", err);

        let errorMessage =
          "Connection error. Please check server configuration.";
        if (err.name === "AbortError") {
          errorMessage =
            "Request timed out. The server may be offline or unreachable.";
        }

        error.value = errorMessage;
        console.error("Error details:", {
          name: err.name,
          message: err.message,
          stack: err.stack,
        });
      } finally {
        isLoading.value = false;
      }
    };

    return {
      username,
      password,
      error,
      isLoading,
      handleLogin,
    };
  },
};
</script>
