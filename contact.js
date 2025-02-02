async function submitcontactform(event) {
    event.preventDefault(); // Prevent the default form submission

    var name = document.getElementById("name").value;
    var email = document.getElementById("email").value;
    var message = document.getElementById("message").value;

    // Email validation
    email = email.toLowerCase();
    if (email.indexOf('@') == -1 || email.indexOf('.') == -1) {
        alert('Please enter a valid email address');
        return;
    }

    try {
        const response = await fetch('http://localhost:3000/contact', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ name, email, message })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        alert('Contact form submitted successfully.');
        document.getElementById('contactform').reset(); // Reset the form after submission
    } catch (error) {
        console.error('Error submitting contact form:', error);
        alert('An error occurred while submitting the contact form.');
    }
}

document.getElementById('contactform').addEventListener('submit', submitcontactform);