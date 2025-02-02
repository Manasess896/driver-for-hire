document.querySelector('form').addEventListener('submit', async (event) => {
    event.preventDefault();

    const formData = new FormData(event.target);
    const email = formData.get('email');
    const token = localStorage.getItem('token'); // Get the JWT token from localStorage
    const submissionType = formData.get('submissionType'); // Get the type of submission

    let data = { email };

    if (submissionType === 'driver') {
        const location = formData.get('location');
        const country = formData.get('country');

        // Function to validate location
        const isValidLocation = await fetch(`https://nominatim.openstreetmap.org/search?q=${location},${country}&format=json`)
            .then(response => response.json())
            .then(data => data.length > 0)
            .catch(() => false);

        if (!isValidLocation) {
            alert('Invalid location. Please enter a valid location.');
            return;
        }

        data = {
            ...data,
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
            experience: formData.get('experience'),
            hasCar: formData.get('option'),
            age: formData.get('age'),
            rate: formData.get('rate')
        };
    } else if (submissionType === 'car') {
        data = {
            ...data,
            carNumberPlate: formData.get('carNumberPlate'),
            mileage: formData.get('mileage'),
            consumption: formData.get('consumption'),
            phone: formData.get('carphone'),
            carImages: []
        };

        for (let i = 1; i <= 6; i++) {
            const imageFile = formData.get(`carImage${i}`);
            if (imageFile && imageFile.size > 0) {
                const reader = new FileReader();
                reader.onloadend = () => {
                    data.carImages.push(reader.result); // Base64-encoded string
                };
                reader.readAsDataURL(imageFile);
            }
        }
    }

    try {
        const response = await fetch('http://localhost:3001/submit-info', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': token // Include the JWT token in the headers
            },
            body: JSON.stringify(data)
        });

        if (response.ok) {
            alert('Information submitted successfully.');
            event.target.reset(); // Clear the form
            window.location.href = 'index.html'; // Redirect to the driver panel
        } else {
            const errorData = await response.json();
            console.error('Failed to submit information:', errorData);
            alert('Failed to submit information: ' + errorData.message);
        }
    } catch (error) {
        console.error('Error submitting information:', error);
        alert('An error occurred while submitting information.');
    }
});
