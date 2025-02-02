async function handleLogin(event) {
    event.preventDefault();
    const submitButton = event.target.querySelector('button[type="submit"]');
    submitButton.disabled = true; // Disable the submit button

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const errorMessage = document.getElementById('error-message');

    try {
        const response = await fetch('http://localhost:3000/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });

        const result = await response.json();
        if (response.ok) {
            alert('Login successful! Please check your email for the verification code.');
            localStorage.setItem('userEmail', email);
            localStorage.setItem('token', result.token); // Store the token
            window.location.href = 'verify-email.html';
        } else {
            errorMessage.textContent = result.message;
            submitButton.disabled = false; // Re-enable the submit button
        }
    } catch (err) {
        errorMessage.textContent = 'An error occurred. Please try again.';
        submitButton.disabled = false; // Re-enable the submit button
    }
}

// Ensure the event listener is only attached once
document.addEventListener('DOMContentLoaded', () => {
    document.querySelector('form').addEventListener('submit', handleLogin);

    // Password toggle
    document.getElementById('togglePassword').addEventListener('click', function () {
        const passwordInput = document.getElementById('password');
        const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
        passwordInput.setAttribute('type', type);
        this.classList.toggle('fa-eye-slash');
    });
});

function forgotpassword() {
    document.getElementById('forgot-password').style.display = 'block';
}

function closeSuccessPopup() {
    document.getElementById('success-popup').style.display = 'none';
}

async function handleForgotPassword(event) {
    event.preventDefault();
    const email = document.getElementById('forgot-email').value;

    try {
        const response = await fetch('http://localhost:3000/forgot-password', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email })
        });

        const result = await response.json();
        if (response.ok) {
            document.getElementById('forgot-password').style.display = 'none';
            document.getElementById('success-popup').style.display = 'block';
        } else {
            alert(result.message);
        }
    } catch (err) {
        alert('An error occurred. Please try again.');
    }
}

