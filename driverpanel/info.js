document.addEventListener('DOMContentLoaded', async () => {
    const storedEmail = localStorage.getItem('userEmail');
    const token = localStorage.getItem('token');

    if (!storedEmail || !token) {
        await Swal.fire({
            title: 'Authentication Required',
            text: 'Please login to continue',
            icon: 'warning',
            confirmButtonText: 'OK'
        });
        window.location.href = 'login.html';
        return;
    }

    // Enhanced submission check function
    async function checkSubmissions() {
        try {
            // First check driver info
            const driverResponse = await fetch(`http://localhost:3001/check-submission?email=${storedEmail}&type=driver`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!driverResponse.ok) {
                throw new Error('Failed to check driver submission');
            }

            const driverData = await driverResponse.json();
            const hasDriverInfo = driverData.submitted;

            // Then check car info
            const carResponse = await fetch(`http://localhost:3001/check-submission?email=${storedEmail}&type=car`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!carResponse.ok) {
                throw new Error('Failed to check car submission');
            }

            const carData = await carResponse.json();
            const hasCarInfo = carData.submitted;

            console.log('Submission status:', {
                driver: hasDriverInfo,
                car: hasCarInfo
            });

            // Handle form visibility based on submissions
            const driverForm = document.getElementById('driver');
            const driverTab = document.querySelector('[data-target="driver"]');
            const carForm = document.getElementById('car');
            const carTab = document.querySelector('[data-target="car"]');
            const menuHeadings = document.querySelector('.menu-headings');

            if (hasDriverInfo && hasCarInfo) {
                // Both submissions exist
                await Swal.fire({
                    title: 'Information Complete',
                    text: 'You have already submitted all required information. Redirecting to driver panel.',
                    icon: 'info',
                    timer: 2000,
                    showConfirmButton: false
                });
                window.location.href = 'index.html';
                return true;
            }

            if (hasDriverInfo) {
                // Hide driver form and show car form
                driverForm.style.display = 'none';
                driverTab.style.display = 'none';
                carForm.classList.add('active');
                menuHeadings.setAttribute('data-active', 'car');
                
                // Show message
                const message = document.createElement('div');
                message.className = 'info-message';
                message.innerHTML = `
                    <p>Driver information already submitted.</p>
                    <p>Please complete your car information below.</p>
                `;
                carForm.insertBefore(message, carForm.firstChild);
            }

            if (hasCarInfo) {
                // Hide car form and show driver form
                carForm.style.display = 'none';
                carTab.style.display = 'none';
                driverForm.classList.add('active');
                menuHeadings.setAttribute('data-active', 'driver');
                
                // Show message
                const message = document.createElement('div');
                message.className = 'info-message';
                message.innerHTML = `
                    <p>Car information already submitted.</p>
                    <p>Please complete your driver information below.</p>
                `;
                driverForm.insertBefore(message, driverForm.firstChild);
            }

            // Hide menu headings if only one form is available
            if (hasDriverInfo || hasCarInfo) {
                menuHeadings.style.display = 'none';
            }

            return false;
        } catch (error) {
            console.error('Error checking submissions:', error);
            await Swal.fire({
                title: 'Error',
                text: 'Failed to check submission status. Please try again.',
                icon: 'error',
                confirmButtonText: 'OK'
            });
            return false;
        }
    }

    // Wait for the submission check before continuing
    const shouldRedirect = await checkSubmissions();
    if (shouldRedirect) {
        return; // Stop execution if redirect is needed
    }

    // Update both forms to include the stored email in a hidden field
    document.querySelectorAll('form').forEach(form => {
        const hiddenEmailInput = document.createElement('input');
        hiddenEmailInput.type = 'hidden';
        hiddenEmailInput.name = 'email';
        hiddenEmailInput.value = storedEmail;
        form.appendChild(hiddenEmailInput);
    });

    const headings = document.querySelectorAll('.menu-headings h2');
    const menuHeadings = document.querySelector('.menu-headings');
    const contents = document.querySelectorAll('.menu-content form');

    headings.forEach(heading => {
        heading.addEventListener('click', () => {
            const target = heading.getAttribute('data-target');

            // Remove active class from all headings and contents
            headings.forEach(h => h.classList.remove('active'));
            contents.forEach(c => c.classList.remove('active'));

            // Add active class to the clicked heading and corresponding content
            heading.classList.add('active');
            document.getElementById(target).classList.add('active');

            // Update the data-active attribute to animate the line
            menuHeadings.setAttribute('data-active', target);
        });
    });

    // Add event listeners to both forms
    document.getElementById('driver').addEventListener('submit', handleSubmit);
    document.getElementById('car').addEventListener('submit', handleSubmit);

    async function processImage(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const imageData = {
                    contentType: file.type,
                    data: reader.result.split(',')[1] // Remove the data URL prefix and get pure base64
                };
                resolve(imageData);
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    // Add utility functions at the top
    function disableButton(button, loadingText = 'Submitting...') {
        button.disabled = true;
        button.originalText = button.textContent;
        button.textContent = loadingText;
    }

    function enableButton(button) {
        button.disabled = false;
        button.textContent = button.originalText;
    }

    // Add these utility functions for age calculations
    function calculateAge(birthDate) {
        const today = new Date();
        const birth = new Date(birthDate);
        let age = today.getFullYear() - birth.getFullYear();
        const monthDiff = today.getMonth() - birth.getMonth();
        
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
            age--;
        }
        
        return age;
    }

    function calculateMaxExperience(age) {
        const DRIVING_AGE = 18;
        return Math.max(0, age - DRIVING_AGE);
    }

    // Add event listener for date of birth input
    document.getElementById('dob').addEventListener('change', function(e) {
        const age = calculateAge(e.target.value);
        const experienceInput = document.getElementById('experience');
        const maxExperience = calculateMaxExperience(age);
        
        if (age < 18) {
            Swal.fire({
                title: 'Age Restriction',
                text: 'You must be at least 18 years old to register as a driver.',
                icon: 'error',
                confirmButtonText: 'OK'
            });
            e.target.value = ''; // Clear the date
            document.getElementById('age').value = '';
            experienceInput.value = '';
            return;
        }

        // Update age field
        document.getElementById('age').value = age;
        
        // Update experience field max attribute and value if needed
        experienceInput.setAttribute('max', maxExperience);
        if (parseInt(experienceInput.value) > maxExperience) {
            experienceInput.value = maxExperience;
        }
    });

    // Add validation for experience input
    document.getElementById('experience').addEventListener('input', function(e) {
        const age = parseInt(document.getElementById('age').value);
        const maxExperience = calculateMaxExperience(age);
        const experience = parseInt(e.target.value);

        if (experience > maxExperience) {
            Swal.fire({
                title: 'Invalid Experience',
                text: `Based on your age, your maximum driving experience cannot exceed ${maxExperience} years.`,
                icon: 'warning',
                confirmButtonText: 'OK'
            });
            e.target.value = maxExperience;
        }
    });

    // Add this function for license plate validation
    function isValidKenyanPlate(plate) {
        const pattern = /^K[A-Za-z]{2}\s\d{3}[A-Za-z]$/;
        return pattern.test(plate);
    }

    // Add event listener for car number plate input
    document.getElementById('carNumberPlate').addEventListener('input', function(e) {
        const plate = e.target.value.toUpperCase();
        e.target.value = plate; // Force uppercase
        
        // Add validation message container if it doesn't exist
        let messageDiv = this.nextElementSibling;
        if (!messageDiv || !messageDiv.classList.contains('plate-validation')) {
            messageDiv = document.createElement('div');
            messageDiv.className = 'plate-validation';
            messageDiv.style.fontSize = '0.8rem';
            messageDiv.style.marginTop = '5px';
            this.parentNode.insertBefore(messageDiv, this.nextSibling);
        }

        if (plate.length > 0) {
            if (isValidKenyanPlate(plate)) {
                messageDiv.style.color = 'green';
                messageDiv.textContent = '✓ Valid plate format';
                this.setCustomValidity('');
            } else {
                messageDiv.style.color = 'red';
                messageDiv.textContent = 'Invalid format. Example: KAA 123A';
                this.setCustomValidity('Please enter a valid Kenyan plate number (e.g., KAA 123A)');
            }
        } else {
            messageDiv.textContent = '';
            this.setCustomValidity('');
        }
    });

    // Add server-side validation in handleSubmit
    async function handleSubmit(event) {
        event.preventDefault();
        const submitButton = event.target.querySelector('button[type="submit"]');
        disableButton(submitButton);

        try {
            const submissionType = event.target.querySelector('button[type="submit"]').dataset.type;
            
            // Check if this type of info was already submitted
            const checkResponse = await fetch(`http://localhost:3001/check-submission?email=${storedEmail}&type=${submissionType}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            const checkData = await checkResponse.json();
            if (checkData.submitted) {
                await Swal.fire({
                    title: 'Already Submitted',
                    text: `You have already submitted your ${submissionType} information.`,
                    icon: 'warning',
                    confirmButtonText: 'OK'
                });
                window.location.href = 'index.html';
                return;
            }

            // Continue with existing submission logic
            const formData = new FormData(event.target);
            const dob = formData.get('dob');
            const experience = parseInt(formData.get('experience'));
            const age = calculateAge(dob);

            // Validate age and experience
            if (age < 18) {
                throw new Error('You must be at least 18 years old to register as a driver.');
            }

            const maxExperience = calculateMaxExperience(age);
            if (experience > maxExperience) {
                throw new Error(`Your driving experience cannot exceed ${maxExperience} years based on your age.`);
            }

            if (submissionType === 'car') {
                const formData = new FormData(event.target);
                const plateNumber = formData.get('carNumberPlate').toUpperCase();

                if (!isValidKenyanPlate(plateNumber)) {
                    await Swal.fire({
                        title: 'Invalid License Plate',
                        text: 'Please enter a valid Kenyan license plate number (e.g., KAA 123A)',
                        icon: 'error',
                        confirmButtonText: 'OK'
                    });
                    enableButton(submitButton);
                    return;
                }
                
                // Log the form data for debugging
                console.log('Car form data:', {
                    carNumberPlate: formData.get('carNumberPlate'),
                    mileage: formData.get('mileage'),
                    consumption: formData.get('consumption'),
                    phone: formData.get('carPhone'),
                    imageCount: Array.from(formData.getAll('images')).length
                });

                const response = await fetch('http://localhost:3001/submit-info', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    },
                    body: formData // Send the FormData directly for file uploads
                });

                const result = await response.json();
                if (response.ok) {
                    await Swal.fire({
                        title: 'Success!',
                        text: 'Car information submitted successfully',
                        icon: 'success'
                    });
                    window.location.href = 'index.html';
                } else {
                    throw new Error(result.message);
                }
            } else {
                const formData = new FormData(event.target);

                const data = {
                    email: localStorage.getItem('userEmail'),
                    submissionType,
                    age: age,
                    experience: experience
                };

                if (submissionType === 'driver') {
                    const imageFile = formData.get('image');
                    if (imageFile && imageFile.size > 0) {
                        data.image = await processImage(imageFile);
                    }

                    Object.assign(data, {
                        name: formData.get('name'),
                        lname: formData.get('lname'),
                        phone: formData.get('phone'),
                        dob: formData.get('dob'),
                        license: formData.get('license'),
                        country: formData.get('country'),
                        location: formData.get('location'),
                        classes: {
                            classA: document.getElementById('classa').checked,
                            classB: document.getElementById('classb').checked,
                            classC: document.getElementById('classc').checked,
                            classD: document.getElementById('classd').checked,
                            classE: document.getElementById('classe').checked,
                            classF: document.getElementById('classf').checked,
                            classG: document.getElementById('classg').checked,
                            classH: document.getElementById('classh').checked,
                        },
                        hasCar: formData.get('option'),
                        rate: formData.get('rate')
                    });
                }

                console.log('Submitting data:', { type: submissionType, email: data.email });

                const response = await fetch('http://localhost:3001/submit-info', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    },
                    body: JSON.stringify(data)
                });

                const result = await response.json();
                
                if (response.status === 401) {
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

                if (response.ok) {
                    await Swal.fire({
                        title: 'Success!',
                        text: 'Information submitted successfully',
                        icon: 'success',
                        showConfirmButton: false,
                        timer: 1500
                    });
                    
                    // Always redirect to driver panel after successful submission
                    window.location.href = 'index.html';
                } else {
                    throw new Error(result.message || 'Failed to submit information');
                }
            }
        } catch (error) {
            await Swal.fire({
                title: 'Error!',
                text: error.message || 'Error submitting information',
                icon: 'error',
                confirmButtonText: 'OK'
            });
        } finally {
            enableButton(submitButton);
        }
    }

    // Add these utility functions after the existing utility functions
    async function fetchCountries() {
        try {
            const response = await fetch('http://geodb-free-service.wirefreethought.com/v1/geo/countries', {
                headers: {
                    'Accept': 'application/json'
                }
            });
            const data = await response.json();
            return data.data.map(country => ({
                code: country.code,
                name: country.name
            }));
        } catch (error) {
            console.error('Error fetching countries:', error);
            return [];
        }
    }

    async function fetchCities(countryCode, namePrefix) {
        try {
            const response = await fetch(
                `http://geodb-free-service.wirefreethought.com/v1/geo/cities?countryIds=${countryCode}&namePrefix=${namePrefix}&limit=10`, {
                headers: {
                    'Accept': 'application/json'
                }
            });
            const data = await response.json();
            return data.data.map(city => ({
                name: city.name,
                region: city.region
            }));
        } catch (error) {
            console.error('Error fetching cities:', error);
            return [];
        }
    }

    // Add this after DOMContentLoaded event starts, before the form submission handlers
    const countrySelect = document.getElementById('country');
    const locationInput = document.getElementById('location');
    const locationSuggestions = document.createElement('datalist');
    locationSuggestions.id = 'locationSuggestions';
    locationInput.setAttribute('list', 'locationSuggestions');
    document.body.appendChild(locationSuggestions);

    // Populate countries dropdown
    async function initializeCountryDropdown() {
        const countries = await fetchCountries();
        countries.sort((a, b) => a.name.localeCompare(b.name));
        
        countrySelect.innerHTML = '<option value="">Select a country</option>';
        countries.forEach(country => {
            const option = document.createElement('option');
            option.value = country.code;
            option.textContent = country.name;
            countrySelect.appendChild(option);
        });
    }

    // Initialize country dropdown
    initializeCountryDropdown();

    // Add city validation
    let cityValidationTimeout;
    locationInput.addEventListener('input', async (e) => {
        clearTimeout(cityValidationTimeout);
        const inputValue = e.target.value;
        const selectedCountryCode = countrySelect.value;

        if (!selectedCountryCode) {
            await Swal.fire({
                title: 'Country Required',
                text: 'Please select a country first',
                icon: 'warning',
                confirmButtonText: 'OK'
            });
            locationInput.value = '';
            return;
        }

        if (inputValue.length < 2) return;

        cityValidationTimeout = setTimeout(async () => {
            const cities = await fetchCities(selectedCountryCode, inputValue);
            locationSuggestions.innerHTML = '';
            cities.forEach(city => {
                const option = document.createElement('option');
                option.value = `${city.name}, ${city.region}`;
                locationSuggestions.appendChild(option);
            });
        }, 300);
    });

    // Initialize the page
    await checkSubmissions();
});

// Add some CSS for the info messages
const style = document.createElement('style');
style.textContent = `
    .info-message {
        padding: 20px;
        background-color: #f8f9fa;
        border-radius: 8px;
        margin: 20px 0;
        text-align: center;
    }
    .info-message p {
        margin: 10px 0;
        color: #666;
    }
    .edit-link {
        display: inline-block;
        margin-top: 10px;
        padding: 8px 16px;
        background-color: #4CAF50;
        color: white;
        text-decoration: none;
        border-radius: 4px;
    }
    .edit-link:hover {
        background-color: #45a049;
    }
`;

// Add these image validation functions after the existing utility functions
function validateImage(file) {
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    const maxSize = 5 * 1024 * 1024; // 5MB
    
    const errors = [];
    
    if (!validTypes.includes(file.type)) {
        errors.push('File must be in JPG, JPEG or PNG format');
    }
    
    if (file.size > maxSize) {
        errors.push('File size must be less than 5MB');
    }
    
    return {
        valid: errors.length === 0,
        errors
    };
}

function createImageFeedback(inputId) {
    let feedbackDiv = document.getElementById(`${inputId}-feedback`);
    if (!feedbackDiv) {
        feedbackDiv = document.createElement('div');
        feedbackDiv.id = `${inputId}-feedback`;
        feedbackDiv.className = 'image-feedback';
        const input = document.getElementById(inputId);
        input.parentNode.insertBefore(feedbackDiv, input.nextSibling);
    }
    return feedbackDiv;
}

// Modify the driver image input listener
document.getElementById('image').addEventListener('change', function(e) {
    const feedbackDiv = createImageFeedback('image');
    const file = e.target.files[0];
    
    if (!file) {
        feedbackDiv.innerHTML = '';
        return;
    }

    const validation = validateImage(file);
    if (validation.valid) {
        feedbackDiv.innerHTML = `
            <div class="valid-feedback">
                <span class="success">✓</span> Image accepted: ${file.name}
                <br>Size: ${(file.size / (1024 * 1024)).toFixed(2)}MB
            </div>`;
        feedbackDiv.className = 'image-feedback valid';
    } else {
        feedbackDiv.innerHTML = `
            <div class="invalid-feedback">
                <span class="error">✕</span> ${validation.errors.join('<br>')}
            </div>`;
        feedbackDiv.className = 'image-feedback invalid';
        this.value = ''; // Clear the invalid input
    }
});

// Modify the car images input listeners
document.querySelectorAll('input[name="images"]').forEach((input, index) => {
    input.addEventListener('change', function(e) {
        const feedbackDiv = createImageFeedback(`car-image-${index}`);
        const file = e.target.files[0];
        
        if (!file) {
            feedbackDiv.innerHTML = '';
            return;
        }

        const validation = validateImage(file);
        if (validation.valid) {
            feedbackDiv.innerHTML = `
                <div class="valid-feedback">
                    <span class="success">✓</span> Image ${index + 1} accepted: ${file.name}
                    <br>Size: ${(file.size / (1024 * 1024)).toFixed(2)}MB
                </div>`;
            feedbackDiv.className = 'image-feedback valid';
        } else {
            feedbackDiv.innerHTML = `
                <div class="invalid-feedback">
                    <span class="error">✕</span> Image ${index + 1}: ${validation.errors.join('<br>')}
                </div>`;
            feedbackDiv.className = 'image-feedback invalid';
            this.value = ''; // Clear the invalid input
        }
    });
});

// Add these styles to the existing style element
const additionalStyles = `
    .image-feedback {
        margin: 5px 0;
        padding: 8px;
        border-radius: 4px;
        font-size: 0.9em;
    }
    .image-feedback.valid {
        background-color: #e8f5e9;
        color: #2e7d32;
    }
    .image-feedback.invalid {
        background-color: #ffebee;
        color: #c62828;
    }
    .image-feedback .success {
        color: #2e7d32;
        font-weight: bold;
    }
    .image-feedback .error {
        color: #c62828;
        font-weight: bold;
    }
    .valid-feedback, .invalid-feedback {
        display: flex;
        align-items: center;
        gap: 8px;
    }
`;

// Update the existing style element
style.textContent += additionalStyles;

document.head.appendChild(style);

// Function to get token from localStorage
function getToken() {
    return localStorage.getItem('token');
}

// Function to fetch user data
async function fetchUserData() {
    try {
        const token = getToken();
        if (!token) {
            window.location.href = 'login.html';
            return;
        }

        const response = await fetch('http://localhost:3001/user-data', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch user data');
        }

        const userData = await response.json();
        
        // Auto-fill the form fields
        document.getElementById('email').value = userData.email;
        document.getElementById('name').value = userData.firstName;
        document.getElementById('lname').value = userData.lastName;
    } catch (error) {
        console.error('Error fetching user data:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Failed to load user data. Please try again later.'
        });
    }
}

// Call fetchUserData when the page loads
document.addEventListener('DOMContentLoaded', fetchUserData);
