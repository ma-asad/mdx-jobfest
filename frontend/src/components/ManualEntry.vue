<template>
  <div class="manual-entry-container">
    <form @submit.prevent="submitForm" class="space-y-4">
      <div>
        <label
          for="studentId"
          class="block text-gray-700 text-sm font-bold mb-2"
        >
          Student ID
        </label>
        <input
          id="studentId"
          v-model="studentId"
          type="text"
          placeholder="Enter Student ID (M followed by 8 digits)"
          class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
          :class="{ 'border-red-500': validationError }"
          @focus="validationError = ''"
        />
        <p v-if="validationError" class="text-red-500 text-xs italic mt-1">
          {{ validationError }}
        </p>
        <p class="text-gray-500 text-xs mt-1">
          Format: M followed by 8 digits (e.g., M00952726)
        </p>
      </div>

      <div class="flex items-center justify-between">
        <button
          type="submit"
          class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
          :disabled="isSubmitting"
        >
          <span v-if="isSubmitting">Submitting...</span>
          <span v-else>Submit</span>
        </button>
        <button
          type="button"
          @click="clearForm"
          class="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
        >
          Clear
        </button>
      </div>
    </form>
  </div>
</template>

<script>
import { ref } from "vue";

export default {
  props: {
    selectedDay: {
      type: Number,
      required: true,
    },
  },
  emits: ["submit"],
  setup(props, { emit }) {
    const studentId = ref("");
    const validationError = ref("");
    const isSubmitting = ref(false);

    // Submit form
    const submitForm = async () => {
      // Validate student ID
      if (!studentId.value.trim()) {
        validationError.value = "Student ID is required";
        return;
      }

      // Updated format validation to match M followed by 8 digits
      if (!/^M\d{8}$/.test(studentId.value.trim())) {
        validationError.value =
          "Please enter a valid Student ID (M followed by 8 digits)";
        return;
      }

      try {
        isSubmitting.value = true;
        emit("submit", studentId.value.trim());
        clearForm();
      } catch (error) {
        console.error("Submission error:", error);
        validationError.value = "An error occurred. Please try again.";
      } finally {
        isSubmitting.value = false;
      }
    };

    // Clear form
    const clearForm = () => {
      studentId.value = "";
      validationError.value = "";
    };

    return {
      studentId,
      validationError,
      isSubmitting,
      submitForm,
      clearForm,
    };
  },
};
</script>
