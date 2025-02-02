document.addEventListener('DOMContentLoaded', () => {
    setAuthHeader();
    const email = localStorage.getItem('userEmail');
    const token = localStorage.getItem('token');
    if (!email || !token) {
        console.log('No email or token found, redirecting to login.');
        window.location.href = 'login.html'; // Redirect to login if not authenticated
    } else {
        console.log('Email and token found, fetching user data.');
        setTimeout(() => fetchUserData(email), 100); // Add a delay to ensure email is set
    }
});

// Function to set the Authorization header with the token
function setAuthHeader() {
    const token = localStorage.getItem('token');
    if (token) {
        // Set the token in the Authorization header for all future requests
        window.fetchWithAuth = (url, options = {}) => {
            options.headers = {
                ...options.headers,
                'Authorization': `Bearer ${token}`
            };
            return fetch(url, options);
        };
    } else {
        console.log('No token available in localStorage.');
    }
}

async function fetchUserData(email) {
    try {
        const response = await fetchWithAuth(`http://localhost:3001/driver-info`, { // Corrected endpoint
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include' // Include cookies in the request
        });
        console.log('Request headers:', response.headers); // Log the request headers
        if (response.ok) {
            const data = await response.json();
            if (!data || Object.keys(data).length === 0) {
                console.log('No user data found, redirecting to info submission.');
                window.location.href = 'info.html'; // Redirect to info submission if no data
            } else {
                console.log('User data fetched successfully:', data);
                displayUserData(data);
                populateEditForm(data);
            }
        } else if (response.status === 401) {
            console.error('Token expired, redirecting to login.');
            localStorage.removeItem('userEmail');
            window.location.href = 'login.html'; // Redirect to login if token expired
        } else {
            console.error('Failed to fetch user data, redirecting to login.');
            window.location.href = 'login.html'; // Redirect to login if fetch fails
        }
    } catch (error) {
        console.error('Error fetching user data:', error);
        window.location.href = 'login.html';
        alert("this is where the error is ") // Redirect to login if fetch fails
    }
}

function displayUserData(data) {
    const userInfoDiv = document.getElementById('user-info');
    const classes = Object.keys(data.classes).filter(cls => data.classes[cls]).join(', ');
    userInfoDiv.innerHTML = `
        <h2>Welcome, ${data.name}</h2>
        <p><strong>Email:</strong> ${data.email}</p>
        <p><strong>Phone:</strong> ${data.phone}</p>
        <p><strong>Date of Birth:</strong> ${data.dob}</p>
        <p><strong>License:</strong> ${data.license}</p>
        <p><strong>Experience:</strong> ${data.experience} years</p>
        <p><strong>Has Car:</strong> ${data.hasCar}</p>
        <p>age: ${data.age}</p>
        <p>rate: ${data.rate}</p>
        <p>location: ${data.location}</p>
        <p><strong>Classes:</strong> ${classes}</p>
        <img src="${data.image}" alt="Driver Image" style="max-width: 200px;">
    `;
}

function populateEditForm(data) {
    document.getElementById('edit-name').value = data.name;
    document.getElementById('edit-email').value = data.email;
    document.getElementById('edit-phone').value = data.phone;
    document.getElementById('edit-dob').value = data.dob;
    document.getElementById('edit-license').value = data.license;
    document.getElementById('edit-experience').value = data.experience;
    document.getElementById('edit-hasCar').value = data.hasCar;
}

function toggleEditForm() {
    const editForm = document.getElementById('edit-form');
    editForm.style.display = editForm.style.display === 'none' ? 'block' : 'none';
}

document.getElementById('edit-form').addEventListener('submit', async (event) => {
    event.preventDefault();

    const formData = new FormData(event.target);
    const data = {
        name: formData.get('name'),
        email: formData.get('email'),
        phone: formData.get('phone'),
        dob: formData.get('dob'),
        license: formData.get('license'),
        experience: formData.get('experience'),
        hasCar: formData.get('hasCar')
    };

    try {
        const response = await fetch('http://localhost:3000/driver-info', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        if (response.ok) {
            alert('Information updated successfully.');
            fetchUserData(localStorage.getItem('userEmail')); // Refresh user data
            toggleEditForm(); // Hide the edit form
        } else {
            const errorData = await response.json();
            console.error('Failed to update information:', errorData);
            alert('Failed to update information: ' + errorData.message);
        }
    } catch (error) {
        console.error('Error updating information:', error);
        alert('An error occurred while updating information.');
    }
});
