async function submitregistrationform(event) {
    event.preventDefault();
    const submitButton = event.target.querySelector('button[type="submit"]');
    submitButton.disabled = true;

    const fname = document.getElementById('fname').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const errorMessage = document.getElementById('error-message');

    const easilyGuessedPasswords = [
        'password', '123456', '123456789', 'qwerty', '12345678', '111111', 
        '1234567', 'abc123', 'password1', '123123'
    ];

    if (easilyGuessedPasswords.includes(password.toLowerCase()) || password.toLowerCase() === fname.toLowerCase()) {
        await Swal.fire({
            icon: 'error',
            title: 'Weak Password',
            text: 'Your password is too easily guessed or matches your name. Please choose a stronger password.',
            confirmButtonColor: '#4CAF50'
        });
        submitButton.disabled = false;
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
            await Swal.fire({
                icon: 'success',
                title: 'Registration Successful!',
                text: 'Please check your email for the verification code.',
                timer: 2000,
                showConfirmButton: false,
                timerProgressBar: true
            });
            localStorage.setItem('userEmail', email);
            localStorage.setItem('token', result.token);
            window.location.href = 'verify-email.html';
        } else {
            await Swal.fire({
                icon: 'error',
                title: 'Registration Failed',
                text: result.message,
                confirmButtonColor: '#4CAF50'
            });
        }
    } catch (err) {
        await Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'An error occurred. Please try again.',
            confirmButtonColor: '#4CAF50'
        });
    } finally {
        submitButton.disabled = false;
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

