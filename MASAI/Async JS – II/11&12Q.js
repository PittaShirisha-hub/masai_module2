// Function to display greeting message
function displayMessage(name) {
  console.log(`Hello, ${name}!`);
}

// Function to simulate getting user input with a callback
function getUserInput(callback) {
  setTimeout(() => {
    const username = "Alice"; // Simulated retrieved username
    callback(username); // Calling the callback with the username
  }, 1000); // 1 second delay
}

// Call getUserInput and pass displayMessage as the callback
getUserInput(displayMessage);
//
// Function to simulate a timer and then call a callback when done
function timer(duration, onComplete) {
  console.log(`Timer started for ${duration} ms...`);

  // Use setTimeout to simulate delay
  setTimeout(() => {
    const message = `Timer of ${duration} ms finished`;
    onComplete(message); // Execute the callback with message
  }, duration);
}

// Callback function to handle completion message
function handleCompletion(message) {
  console.log(message);
}

// Example usage
timer(2000, handleCompletion); // Runs for 2 seconds