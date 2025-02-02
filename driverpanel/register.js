async function submitregistrationform(event) {
    event.preventDefault();
    const submitButton = event.target.querySelector('button[type="submit"]');
    submitButton.disabled = true; // Disable the submit button

    const fname = document.getElementById('fname').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const errorMessage = document.getElementById('error-message');

    const easilyGuessedPasswords = [
        'password', '123456', '123456789', 'qwerty', '12345678', '111111', 
        '1234567', 'abc123', 'password1', '123123'
    ];

    // // Password validation
    // const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    // if (!passwordRegex.test(password)) {
    //     errorMessage.textContent = 'Your password is weak. It must be at least 8 characters long and include a mix of uppercase, lowercase, numbers, and special characters.';
    //     submitButton.disabled = false; // Re-enable the submit button
    //     return;
    // }

    if (easilyGuessedPasswords.includes(password.toLowerCase()) || password.toLowerCase() === fname.toLowerCase()) {
        errorMessage.textContent = 'Your password is too easily guessed or matches your name. Please choose a stronger password.';
        submitButton.disabled = false; // Re-enable the submit button
        return;
    }

    try {
        const response = await fetch('http://localhost:3000/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name: fname, email, password })
        });

        const result = await response.json();
        if (response.ok) {
            alert('Registration successful! Please check your email for the verification code.');
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

async function verifyEmailCode(event) {
    event.preventDefault();
    const email = document.getElementById('email').value;
    const code = document.getElementById('verification-code').value;
    const errorMessage = document.getElementById('error-message');

    try {
        const response = await fetch('http://localhost:3000/verify-email-code', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, code })
        });

        const result = await response.json();
        if (response.ok) {
            alert('Email verified successfully!');
            window.location.href = 'login.html';
        } else {
            errorMessage.textContent = result.message;
        }
    } catch (err) {
        errorMessage.textContent = 'An error occurred. Please try again.';
    }
}

document.getElementById('togglePassword').addEventListener('click', function () {
    const passwordInput = document.getElementById('password');
    const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
    passwordInput.setAttribute('type', type);
    this.classList.toggle('fa-eye-slash');
});

