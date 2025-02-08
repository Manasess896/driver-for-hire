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
    loadImages();
    initSessionTimer(); // Add session timer initialization
    displayControls(); // Add display controls
});

// Add this utility function at the top
function disableButton(button, loadingText = 'Processing...') {
    button.disabled = true;
    button.originalText = button.textContent;
    button.textContent = loadingText;
}

function enableButton(button) {
    button.disabled = false;
    button.textContent = button.originalText;
}

// Function to set the Authorization header with the token
function setAuthHeader() {
    const token = localStorage.getItem('token');
    if (token) {
        // Set the token in the Authorization header for all future requests
        window.fetchWithAuth = async (url, options = {}) => {
            const token = localStorage.getItem('token');
            if (!token) {
                await Swal.fire({
                    title: 'Session Expired',
                    text: 'Please log in again to continue.',
                    icon: 'warning',
                    confirmButtonText: 'OK'
                });
                window.location.href = 'login.html';
                return;
            }
        
            options.headers = {
                ...options.headers,
                'Authorization': `Bearer ${token}`
            };
        
            try {
                const response = await fetch(url, options);
                if (response.status === 401) {
                    const data = await response.json();
                    if (data.expired) {
                        localStorage.removeItem('token');
                        await Swal.fire({
                            title: 'Session Expired',
                            text: 'Your session has expired. Please log in again to continue.',
                            icon: 'warning',
                            confirmButtonText: 'OK'
                        });
                        window.location.href = 'login.html';
                        return;
                    }
                }
                return response;
            } catch (error) {
                console.error('Fetch error:', error);
                throw error;
            }
        };
    } else {
        console.log('No token available in localStorage.');
    }
}

async function fetchUserData(email) {
    try {
        // Check both driver and car info simultaneously
        const [driverResponse, carResponse] = await Promise.all([
            fetchWithAuth(`http://localhost:3001/driver-info`),
            fetchWithAuth(`http://localhost:3001/car-info`)
        ]);

        const driverData = await driverResponse.json();
        const carData = await carResponse.json();

        console.log('User data status:', {
            hasDriverInfo: Object.keys(driverData).length > 0,
            hasCarInfo: Object.keys(carData).length > 0
        });

        // If no data at all, redirect to info submission
        if (Object.keys(driverData).length === 0 && Object.keys(carData).length === 0) {
            console.log('No user data found, redirecting to info submission.');
            window.location.href = 'info.html';
            return;
        }

        // Display whatever data is available
        if (Object.keys(driverData).length > 0) {
            displayDriverData(driverData);
        }
        if (Object.keys(carData).length > 0) {
            displayCarData(carData);
        }

        // Show add info button if either type is missing
        const needsMoreInfo = !Object.keys(driverData).length || !Object.keys(carData).length;
        if (needsMoreInfo) {
            showAddInfoButton();
        }

    } catch (error) {
        console.error('Error fetching user data:', error);
        alert('Error loading user information. Please try again.');
    }
}

// Update the Add Info button handler
function showAddInfoButton() {
    const container = document.querySelector('.user-info');
    const button = document.createElement('button');
    button.className = 'add-info-btn';
    button.textContent = 'Add More Information';
    button.addEventListener('click', async (e) => {
        disableButton(e.target);
        try {
            window.location.href = 'info.html';
        } finally {
            enableButton(e.target);
        }
    });
    container.appendChild(button);
}

// Image handling functions
async function displayImage(imageData, container) {
    if (imageData && imageData.data && imageData.contentType) {
        const img = document.createElement('img');
        img.src = `data:${imageData.contentType};base64,${imageData.data}`;
        img.alt = 'Image';
        img.style.maxWidth = '200px';
        container.appendChild(img);
    }
}

async function loadImages() {
    const email = localStorage.getItem('userEmail');
    const token = localStorage.getItem('token');

    if (!email || !token) return;

    try {
        const [driverResponse, carResponse] = await Promise.all([
            fetchWithAuth(`http://localhost:3001/driver-info`),
            fetchWithAuth(`http://localhost:3001/car-info`)
        ]);

        if (driverResponse.ok) {
            const data = await driverResponse.json();
            if (data.image) {
                const container = document.getElementById('driver-image-container');
                if (!container) {
                    // Create container if it doesn't exist
                    const newContainer = document.createElement('div');
                    newContainer.id = 'driver-image-container';
                    document.querySelector('.driver-info-section').appendChild(newContainer);
                }
                await displayImage(data.image, container);
            }
        }

        if (carResponse.ok) {
            const data = await carResponse.json();
            if (data.carImages && data.carImages.length > 0) {
                const container = document.getElementById('car-images-container');
                if (!container) {
                    // Create container if it doesn't exist
                    const newContainer = document.createElement('div');
                    newContainer.id = 'car-images-container';
                    document.querySelector('.car-info-section').appendChild(newContainer);
                }
                for (const imageData of data.carImages) {
                    await displayImage(imageData, container);
                }
            }
        }
    } catch (error) {
        console.error('Error loading images:', error);
    }
}

// Update the existing function to include image loading
async function displayDriverData(data) {
    const userInfoDiv = document.getElementById('user-info');
    const driverSection = document.createElement('div');
    driverSection.className = 'driver-info-section';
    
    // Add edit button in the section header
    driverSection.innerHTML = `
        <div class="section-header">
            <h2>Driver Information</h2>
            <button class="edit-btn" onclick="editDriverInfo()">Edit Info</button>
        </div>
        <div class="info-content">
            <p><strong>Name:</strong> ${data.name} ${data.lname}</p>
            <p><strong>Email:</strong> ${data.email}</p>
            <p><strong>Phone:</strong> ${data.phone}</p>
            <p><strong>Date of Birth:</strong> ${data.dob}</p>
            <p><strong>License:</strong> ${data.license}</p>
            <p><strong>Experience:</strong> ${data.experience} years</p>
            <p><strong>Has Car:</strong> ${data.hasCar}</p>
            <p><strong>Age:</strong> ${data.age}</p>
            <p><strong>Rate:</strong> $${data.rate}/km</p>
            <p><strong>Location:</strong> ${data.location}</p>
            <p><strong>Classes:</strong> ${Object.entries(data.classes)
                .filter(([_, value]) => value)
                .map(([key]) => key.replace('class', 'Class '))
                .join(', ')}</p>
        </div>
        <div id="driver-image-container" class="image-container"></div>
    `;

    userInfoDiv.appendChild(driverSection);
    if (data.image) {
        await displayImage(data.image, document.getElementById('driver-image-container'));
    }

    // Store the data for editing
    window.driverData = data;
}

// Add edit function
async function editDriverInfo() {
    const data = window.driverData;
    if (!data) return;

    const { value: formValues } = await Swal.fire({
        title: 'Edit Driver Information',
        html: `
            <form id="edit-driver-form" class="form-grid">
                <div class="form-group">
                    <label for="edit-name">First Name</label>
                    <input type="text" id="edit-name" value="${data.name}" required>
                </div>
                <div class="form-group">
                    <label for="edit-lname">Last Name</label>
                    <input type="text" id="edit-lname" value="${data.lname}" required>
                </div>
                <div class="form-group">
                    <label for="edit-phone">Phone</label>
                    <input type="tel" id="edit-phone" value="${data.phone}" required>
                </div>
                <div class="form-group">
                    <label for="edit-age">Age</label>
                    <input type="number" id="edit-age" value="${data.age}" required>
                </div>
                <div class="form-group">
                    <label for="edit-rate">Rate ($/km)</label>
                    <input type="number" id="edit-rate" value="${data.rate}" step="0.01" required>
                </div>
                <div class="form-group">
                    <label for="edit-location">Location</label>
                    <input type="text" id="edit-location" value="${data.location}" required>
                </div>
                <div class="form-group">
                    <label for="edit-experience">Experience (years)</label>
                    <input type="number" id="edit-experience" value="${data.experience}" required>
                </div>
                <div class="form-group">
                    <label for="edit-image">Update Profile Image</label>
                    <input type="file" id="edit-image" accept="image/*">
                </div>
            </form>
        `,
        showCancelButton: true,
        confirmButtonText: 'Save Changes',
        cancelButtonText: 'Cancel',
        preConfirm: async () => {
            const formData = {
                name: document.getElementById('edit-name').value,
                lname: document.getElementById('edit-lname').value,
                phone: document.getElementById('edit-phone').value,
                age: document.getElementById('edit-age').value,
                rate: document.getElementById('edit-rate').value,
                location: document.getElementById('edit-location').value,
                experience: document.getElementById('edit-experience').value
            };

            const imageFile = document.getElementById('edit-image').files[0];
            if (imageFile) {
                formData.image = await processImage(imageFile);
            }

            return formData;
        }
    });

    if (formValues) {
        try {
            const response = await fetchWithAuth('http://localhost:3001/driver-info', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    ...formValues,
                    email: data.email
                })
            });

            if (response.ok) {
                await Swal.fire({
                    title: 'Success!',
                    text: 'Information updated successfully',
                    icon: 'success',
                    timer: 1500,
                    showConfirmButton: false
                });
                // Refresh the page to show updated info
                location.reload();
            } else {
                throw new Error('Failed to update information');
            }
        } catch (error) {
            await Swal.fire({
                title: 'Error!',
                text: error.message || 'Failed to update information',
                icon: 'error'
            });
        }
    }
}

// Update the existing function to include image loading
async function displayCarData(data) {
    const userInfoDiv = document.getElementById('user-info');
    const carSection = document.createElement('div');
    carSection.className = 'car-info-section';
    
    // Add edit button in section header
    carSection.innerHTML = `
        <div class="section-header">
            <h2>Car Information</h2>
            <button class="edit-btn" onclick="editCarInfo()">Edit Car Info</button>
        </div>
        <div class="info-content">
            <p><strong>Number Plate:</strong> ${data.carNumberPlate}</p>
            <p><strong>Mileage:</strong> ${data.mileage}</p>
            <p><strong>Consumption:</strong> ${data.consumption} L/100km</p>
            <p><strong>Phone:</strong> ${data.phone}</p>
        </div>
        <div id="car-images-container" class="image-gallery"></div>
    `;
    
    userInfoDiv.appendChild(carSection);

    // Store car data for editing
    window.carData = data;

    // Handle image display
    if (data.carImages && data.carImages.length > 0) {
        const container = document.getElementById('car-images-container');
        for (const imageData of data.carImages) {
            await displayImage(imageData, container);
        }
    }
}

// Add car edit function
async function editCarInfo() {
    const data = window.carData;
    if (!data) return;

    const { value: formValues } = await Swal.fire({
        title: 'Edit Car Information',
        html: `
            <form id="edit-car-form" class="form-grid">
                <div class="form-group">
                    <label for="edit-plate">Number Plate</label>
                    <input type="text" id="edit-plate" value="${data.carNumberPlate}"
                        pattern="^K[A-Za-z]{2}\\s\\d{3}[A-Za-z]$"
                        title="Please enter a valid Kenyan plate number (e.g., KAA 123A)"
                        required>
                </div>
                <div class="form-group">
                    <label for="edit-mileage">Mileage</label>
                    <input type="number" id="edit-mileage" value="${data.mileage}" required>
                </div>
                <div class="form-group">
                    <label for="edit-consumption">Consumption (L/100km)</label>
                    <input type="number" id="edit-consumption" value="${data.consumption}" step="0.1" required>
                </div>
                <div class="form-group">
                    <label for="edit-car-phone">Phone</label>
                    <input type="tel" id="edit-car-phone" value="${data.phone}" required>
                </div>
                <div class="form-group">
                    <label for="edit-car-images">Update Car Images</label>
                    <input type="file" id="edit-car-images" accept="image/*" multiple>
                    <small>Select up to 6 new images</small>
                </div>
            </form>
        `,
        showCancelButton: true,
        confirmButtonText: 'Save Changes',
        cancelButtonText: 'Cancel',
        preConfirm: async () => {
            const plateNumber = document.getElementById('edit-plate').value.toUpperCase();
            if (!isValidKenyanPlate(plateNumber)) {
                Swal.showValidationMessage('Please enter a valid Kenyan plate number (e.g., KAA 123A)');
                return false;
            }

            const formData = {
                carNumberPlate: plateNumber,
                mileage: document.getElementById('edit-mileage').value,
                consumption: document.getElementById('edit-consumption').value,
                phone: document.getElementById('edit-car-phone').value
            };

            const imageFiles = document.getElementById('edit-car-images').files;
            if (imageFiles.length > 0) {
                const newImages = [];
                for (const file of imageFiles) {
                    newImages.push(await processImage(file));
                }
                formData.carImages = newImages;
            }

            return formData;
        }
    });

    if (formValues) {
        try {
            const response = await fetchWithAuth('http://localhost:3001/car-info', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    ...formValues,
                    email: data.email
                })
            });

            if (response.ok) {
                await Swal.fire({
                    title: 'Success!',
                    text: 'Car information updated successfully',
                    icon: 'success',
                    timer: 1500,
                    showConfirmButton: false
                });
                location.reload();
            } else {
                throw new Error('Failed to update car information');
            }
        } catch (error) {
            await Swal.fire({
                title: 'Error!',
                text: error.message || 'Failed to update car information',
                icon: 'error'
            });
        }
    }
}

function populateEditForm(data) {
    // Basic information
    document.getElementById('edit-name').value = data.name || '';
    document.getElementById('edit-lname').value = data.lname || '';
    document.getElementById('edit-phone').value = data.phone || '';
    document.getElementById('edit-dob').value = data.dob || '';
    document.getElementById('edit-license').value = data.license || '';
    document.getElementById('edit-experience').value = data.experience || '';
    document.getElementById('edit-age').value = data.age || '';
    document.getElementById('edit-rate').value = data.rate || '';
    document.getElementById('edit-location').value = data.location || '';
    document.getElementById('edit-hasCar').value = data.hasCar || 'no';

    // License classes
    if (data.classes) {
        Object.entries(data.classes).forEach(([className, isChecked]) => {
            const checkbox = document.getElementById(`edit-${className.toLowerCase()}`);
            if (checkbox) checkbox.checked = isChecked;
        });
    }
}

async function handleEditSubmit(event) {
    event.preventDefault();
    const submitButton = event.target.querySelector('button[type="submit"]');
    disableButton(submitButton, 'Saving...');

    try {
        const formData = new FormData(event.target);
        const imageFile = formData.get('image');

        // Process the image if a new one is selected
        let imageData = null;
        if (imageFile && imageFile.size > 0) {
            imageData = await processImage(imageFile);
        }

        const data = {
            name: formData.get('name'),
            lname: formData.get('lname'),
            phone: formData.get('phone'),
            dob: formData.get('dob'),
            license: formData.get('license'),
            experience: formData.get('experience'),
            age: formData.get('age'),
            rate: formData.get('rate'),
            location: formData.get('location'),
            hasCar: formData.get('hasCar'),
            classes: {
                classA: document.getElementById('edit-classa').checked,
                classB: document.getElementById('edit-classb').checked,
                classC: document.getElementById('edit-classc').checked,
                classD: document.getElementById('edit-classd').checked,
                classE: document.getElementById('edit-classe').checked,
                classF: document.getElementById('edit-classf').checked,
                classG: document.getElementById('edit-classg').checked,
                classH: document.getElementById('edit-classh').checked,
            }
        };

        if (imageData) {
            data.image = imageData;
        }

        const response = await fetchWithAuth('http://localhost:3001/driver-info', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        if (response.ok) {
            await Swal.fire({
                title: 'Success!',
                text: 'Information updated successfully',
                icon: 'success'
            });
            await fetchUserData(localStorage.getItem('userEmail'));
            toggleEditForm();
        } else {
            throw new Error('Failed to update information');
        }
    } catch (error) {
        await Swal.fire({
            title: 'Error!',
            text: error.message || 'Failed to update information',
            icon: 'error'
        });
    } finally {
        enableButton(submitButton);
    }
}

// Update Edit button handler
function toggleEditForm() {
    const editButton = document.querySelector('.edit-btn');
    disableButton(editButton);
    
    setTimeout(() => {
        const editForm = document.getElementById('edit-form');
        editForm.style.display = editForm.style.display === 'none' ? 'block' : 'none';
        enableButton(editButton);
    }, 500);
}

// Update form submission handler
document.getElementById('edit-form').addEventListener('submit', handleEditSubmit);

// Handle network errors
window.addEventListener('offline', () => {
    Swal.fire({
        title: 'No Internet Connection',
        text: 'Please check your internet connection and try again.',
        icon: 'warning',
        confirmButtonText: 'OK'
    });
});

// Add session timer functionality
function initSessionTimer() {
    const token = localStorage.getItem('token');
    if (!token) return;

    // Add development mode indicator
    const timerContainer = document.querySelector('.session-timer');
    const devModeIndicator = document.createElement('div');
    devModeIndicator.style.fontSize = '0.7rem';
    devModeIndicator.style.color = '#666';
    devModeIndicator.textContent = '⚙️ Development Mode: 1 Hour Session';
    timerContainer.appendChild(devModeIndicator);

    // Decode the JWT to get expiration time
    const tokenData = JSON.parse(atob(token.split('.')[1]));
    const expirationTime = tokenData.exp * 1000; // Convert to milliseconds
    const startTime = Date.now();
    const totalDuration = expirationTime - startTime;

    const progressBar = document.getElementById('sessionProgress');
    const timeRemaining = document.getElementById('timeRemaining');

    function updateProgress() {
        const currentTime = Date.now();
        const elapsed = currentTime - startTime;
        const remaining = totalDuration - elapsed;

        if (remaining <= 0) {
            // Session expired
            clearInterval(timerInterval);
            Swal.fire({
                title: 'Session Expired',
                text: 'Your session has expired. Please login again.',
                icon: 'warning',
                confirmButtonText: 'OK'
            }).then(() => {
                localStorage.removeItem('token');
                window.location.href = 'login.html';
            });
            return;
        }

        // Update progress bar
        const percentageRemaining = (remaining / totalDuration) * 100;
        progressBar.style.width = `${percentageRemaining}%`;

        // Change color based on remaining time
        if (percentageRemaining < 20) {
            progressBar.style.backgroundColor = '#dc3545'; // Red
        } else if (percentageRemaining < 50) {
            progressBar.style.backgroundColor = '#ffc107'; // Yellow
        }

        // Update timer text
        const hours = Math.floor(remaining / 3600000);
        const minutes = Math.floor((remaining % 3600000) / 60000);
        const seconds = Math.floor((remaining % 60000) / 1000);
        timeRemaining.textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

        // Show warning when 5 minutes remaining
        if (remaining <= 300000 && remaining > 299000) { // Check only once at 5 minutes
            Swal.fire({
                title: 'Session Ending Soon',
                text: 'Your session will expire in 5 minutes. Would you like to extend?',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'Extend Session',
                cancelButtonText: 'Not Now'
            }).then((result) => {
                if (result.isConfirmed) {
                    refreshSession();
                }
            });
        }

        // Show warning popup when 2 minutes remaining
        if (remaining <= 120000 && remaining > 119000) { // Check at 2 minutes
            Swal.fire({
                title: 'Session Ending Soon',
                html: `
                    <p>Your session will expire in 2 minutes.</p>
                    <p>Would you like to extend your session or exit?</p>
                `,
                icon: 'warning',
                showDenyButton: true,
                showCancelButton: true,
                confirmButtonText: 'Extend Session',
                denyButtonText: 'Exit Now',
                cancelButtonText: 'Remind Me Later',
                allowOutsideClick: false,
                allowEscapeKey: false
            }).then((result) => {
                if (result.isConfirmed) {
                    refreshSession();
                } else if (result.isDenied) {
                    // User chose to exit
                    localStorage.removeItem('token');
                    window.location.href = 'login.html';
                } else {
                    // User chose "Remind Me Later"
                    // Show another popup in 30 seconds
                    setTimeout(() => {
                        if (document.hidden) {
                            // If tab is not active, show notification if supported
                            if (Notification.permission === "granted") {
                                new Notification("Session Expiring", {
                                    body: "Your session will expire soon. Please return to the tab to extend.",
                                    icon: "/favicon.ico"
                                });
                            }
                        }
                        Swal.fire({
                            title: 'Final Warning',
                            text: 'Your session will expire in 30 seconds. Extend now?',
                            icon: 'warning',
                            showCancelButton: true,
                            confirmButtonText: 'Extend Session',
                            cancelButtonText: 'Let Expire',
                            allowOutsideClick: false,
                            allowEscapeKey: false
                        }).then((result) => {
                            if (result.isConfirmed) {
                                refreshSession();
                            }
                        });
                    }, 90000); // Show final warning with 30 seconds remaining
                }
            });
        }
    }

    // Update every second
    const timerInterval = setInterval(updateProgress, 1000);
    updateProgress(); // Initial update

    // Add to window for cleanup
    window.sessionTimerInterval = timerInterval;
}

// Update refresh session function to be more robust
async function refreshSession() {
    try {
        const loadingAlert = Swal.fire({
            title: 'Extending Session',
            text: 'Please wait...',
            allowOutsideClick: false,
            allowEscapeKey: false,
            showConfirmButton: false,
            willOpen: () => {
                Swal.showLoading();
            }
        });

        const email = localStorage.getItem('userEmail');
        const response = await fetch('http://localhost:3001/refresh-token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ email })
        });

        if (response.ok) {
            const data = await response.json();
            localStorage.setItem('token', data.token);
            
            // Clear existing timer and start new one
            clearInterval(window.sessionTimerInterval);
            initSessionTimer();

            loadingAlert.close();
            await Swal.fire({
                title: 'Session Extended',
                text: 'Your session has been extended successfully',
                icon: 'success',
                timer: 2000,
                showConfirmButton: false
            });
        } else {
            throw new Error('Failed to refresh session');
        }
    } catch (error) {
        console.error('Error refreshing session:', error);
        await Swal.fire({
            title: 'Error',
            text: 'Failed to extend session. Please try logging in again.',
            icon: 'error',
            confirmButtonText: 'OK'
        }).then(() => {
            window.location.href = 'login.html';
        });
    }
}

// Cleanup on page unload
window.addEventListener('unload', () => {
    if (window.sessionTimerInterval) {
        clearInterval(window.sessionTimerInterval);
    }
});

// Add delete button to UI
async function displayControls() {
    const container = document.querySelector('.panel-container');
    const controlsSection = document.createElement('div');
    controlsSection.className = 'account-controls';
    controlsSection.innerHTML = `
        <button class="danger-button" onclick="handleDeleteRequest()">
            Delete My Information
        </button>
    `;
    container.appendChild(controlsSection);
}

async function handleDeleteRequest() {
    let userInfo = {
        driver: false,
        car: false
    };

    try {
        // Check what information the user has
        const [driverResponse, carResponse] = await Promise.all([
            fetchWithAuth(`http://localhost:3001/driver-info`),
            fetchWithAuth(`http://localhost:3001/car-info`)
        ]);

        const driverData = await driverResponse.json();
        const carData = await carResponse.json();

        userInfo.driver = Object.keys(driverData).length > 0;
        userInfo.car = Object.keys(carData).length > 0;

        // If user has no information
        if (!userInfo.driver && !userInfo.car) {
            await Swal.fire({
                title: 'No Information Found',
                text: 'You have no information to delete.',
                icon: 'info'
            });
            return;
        }

        // Prepare options based on available information
        let inputOptions = {};
        if (userInfo.driver) inputOptions.driver = 'Driver Information Only';
        if (userInfo.car) inputOptions.car = 'Car Information Only';
        if (userInfo.driver && userInfo.car) inputOptions.both = 'All Driver & Car Information';
        inputOptions.account = 'Complete Account Deletion';

        // Ask user what they want to delete
        const { value: deleteChoice } = await Swal.fire({
            title: 'Delete Information',
            text: 'What would you like to delete?',
            icon: 'warning',
            input: 'radio',
            inputOptions,
            showCancelButton: true,
            confirmButtonText: 'Continue',
            cancelButtonText: 'Cancel',
            inputValidator: (value) => {
                if (!value) return 'You need to choose an option!';
            }
        });

        if (deleteChoice) {
            // Additional confirmation with consequences
            const confirmText = {
                driver: 'This will delete your driver profile. You can still use your car information.',
                car: 'This will delete your car information. You can still use your driver profile.',
                both: 'This will delete ALL your information but keep your account active.',
                account: 'This will PERMANENTLY delete your entire account, including all information and login access.'
            };

            const finalConfirmation = await Swal.fire({
                title: 'Are you sure?',
                html: `
                    <p>${confirmText[deleteChoice]}</p>
                    <p>Your information will be archived for 30 days.</p>
                    ${deleteChoice === 'account' ? '<p class="text-danger"><strong>Warning:</strong> Account deletion cannot be undone after 30 days!</p>' : ''}
                    ${deleteChoice === 'account' ? '<input type="password" id="confirmPassword" class="swal2-input" placeholder="Enter your password to confirm">' : ''}
                `,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#d33',
                confirmButtonText: 'Yes, delete it',
                cancelButtonText: 'No, keep it',
                preConfirm: async () => {
                    if (deleteChoice === 'account') {
                        const password = document.getElementById('confirmPassword').value;
                        if (!password) {
                            Swal.showValidationMessage('Please enter your password to confirm deletion');
                            return false;
                        }
                        return { password };
                    }
                    return true;
                }
            });

            if (finalConfirmation.isConfirmed) {
                try {
                    const response = await fetchWithAuth('http://localhost:3001/delete-info', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ 
                            type: deleteChoice,
                            password: finalConfirmation.value?.password 
                        })
                    });

                    if (response.ok) {
                        await Swal.fire({
                            title: 'Deleted!',
                            text: deleteChoice === 'account' 
                                ? 'Your account has been scheduled for deletion. You will be logged out now.'
                                : 'Selected information has been deleted.',
                            icon: 'success'
                        });

                        if (deleteChoice === 'account' || deleteChoice === 'both') {
                            localStorage.removeItem('token');
                            window.location.href = 'login.html';
                        } else {
                            location.reload();
                        }
                    } else {
                        throw new Error('Failed to delete information');
                    }
                } catch (error) {
                    console.error('Delete error:', error);
                    await Swal.fire({
                        title: 'Error!',
                        text: 'Failed to delete information. Please try again.',
                        icon: 'error'
                    });
                }
            }
        }
    } catch (error) {
        console.error('Error checking user information:', error);
        await Swal.fire({
            title: 'Error!',
            text: 'Failed to check user information. Please try again.',
            icon: 'error'
        });
    }
}
