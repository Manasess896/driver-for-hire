function opennavbar() {
  document.getElementById("navbar").style.width = "100%";
}

function closenavbar() {
  document.getElementById("navbar").style.width = "0%";
}

// Function to get data from the API
 document.addEventListener('DOMContentLoaded', () => {
 fetchUserInfo();
 });

// Update the fetch function to show loading state
async function fetchUserInfo() {
  const driverContainer = document.querySelector('.driver-container');
  const carContainer = document.querySelector('.car-container');
  
  
  if (driverContainer) driverContainer.innerHTML = '<p>Loading drivers...</p>';
  if (carContainer) carContainer.innerHTML = '<p>Loading cars...</p>';

  try {
    const response = await fetch('http://localhost:3000/all-info');
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    
    const data = await response.json();
    console.log('Fetched data:', data);
    
    // Debug: Check data structure
    console.log('Number of drivers:', data.drivers?.length);
    console.log('Number of cars:', data.cars?.length);
    
    // Debug: Add visual feedback
    if (driverContainer) {
      driverContainer.style.border = '2px solid blue';
    }
    if (carContainer) {
      carContainer.style.border = '2px solid green';
    }
    
    displayDrivers(data.drivers);
    displayCars(data.cars);
  } catch (err) {
    console.error('Failed to fetch info:', err);
    Swal.fire({
      icon: 'error',
      title: 'Oops...',
      text: 'Failed to load data. Please try again later.',
      confirmButtonColor: '#3085d6'
    });
    if (driverContainer) driverContainer.innerHTML = '<p>Error loading drivers.</p>';
    if (carContainer) carContainer.innerHTML = '<p>Error loading cars.</p>';
  }
}

function displayDrivers(drivers) {
  const driverContainer = document.querySelector('.driver-container');
  
  if (!driverContainer || !Array.isArray(drivers)) {
    console.error('Invalid container or drivers data');
    return;
  }
  
  driverContainer.innerHTML = '';
  
  if (drivers.length === 0) {
    driverContainer.innerHTML = '<p>No drivers found</p>';
    return;
  }

  drivers.forEach((driver, index) => {
    try {
      const userElement = document.createElement('div');
      userElement.className = 'driver';
      userElement.setAttribute('data-aos', 'fade-up');
      userElement.setAttribute('data-aos-delay', `${index * 100}`);
      
      // Calculate average rating
      const ratings = driver.ratings || [];
      const averageRating = ratings.length ? 
        (ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length).toFixed(1) : 
        'No ratings';

      // Create reviews HTML with a unique ID for each slider
      const sliderId = `slider-${driver.email.replace('@', '-at-')}`;
      const reviewsHTML = ratings.length ? `
        <div class="review-slider" id="${sliderId}">
          <div class="reviews-wrapper">
            ${ratings.map((r, index) => `
              <div class="review ${index === 0 ? 'active' : ''}">
                <div class="rating-stars">⭐ ${r.rating}/5</div>
                <p class="review-text">${r.review}</p>
                <small class="review-date">${new Date(r.date).toLocaleDateString()}</small>
              </div>
            `).join('')}
          </div>
          <div class="review-count">${ratings.length} review${ratings.length !== 1 ? 's' : ''}</div>
        </div>
      ` : '<p class="no-reviews">No reviews yet</p>';

      // Rest of your driver card HTML with enhanced icons
      userElement.innerHTML = `
        <div class="driver-info">
          <h3><i class="fas fa-user-circle"></i> ${driver.name || 'Unknown'} ${driver.lname || ''}</h3>
          <img src="${driver.image || './images/default-avatar.jpg'}" alt="Driver photo" 
               onerror="this.src='./images/default-avatar.jpg'"
               loading="lazy">
          <div class="contact-info">
            <p><i class="fas fa-phone"></i> <a href="tel:${driver.phone || '#'}">${driver.phone || 'N/A'}</a></p>
            <p><i class="fas fa-envelope"></i> <a href="mailto:${driver.email || '#'}">${driver.email || 'N/A'}</a></p>
          </div>
          <div class="driver-details">
            <p class="average-rating"><i class="fas fa-star"></i> ${averageRating}/5</p>
            <p><i class="fas fa-car"></i> Has Car: ${driver.hasCar ? 'Yes' : 'No'}</p>
            <p><i class="fas fa-map-marker-alt"></i> ${driver.location || 'N/A'}</p>
            <p><i class="fas fa-money-bill-wave"></i> ${driver.rate || 'N/A'}/km</p>
          </div>
          <div class="reviews-section">
            ${reviewsHTML}
          </div>
        </div>
      `;
      
      driverContainer.appendChild(userElement);

      // Initialize slider if there are reviews
      if (ratings.length > 0) {
        console.log(`Initializing slider for ${sliderId}`);
        initializeReviewSlider(sliderId, ratings.length);
      }
    } catch (error) {
      console.error('Error displaying driver:', error);
    }
  });
}

function initializeReviewSlider(sliderId, reviewCount) {
  const slider = document.getElementById(sliderId);
  if (!slider) return;

  const reviews = slider.querySelectorAll('.review');
  let currentIndex = 0;

  // Function to show a specific review
  const showReview = (index) => {
    reviews.forEach((review, i) => {
      if (i === index) {
        review.classList.add('active');
      } else {
        review.classList.remove('active');
      }
    });
  };

  // Show the first review
  showReview(0);

  // Auto rotate reviews
  const rotateReviews = () => {
    currentIndex = (currentIndex + 1) % reviewCount;
    showReview(currentIndex);
  };

  // Start the rotation
  const intervalId = setInterval(rotateReviews, 5000);

  // Cleanup on page changes
  return () => clearInterval(intervalId);
}

function displayCars(cars) {
  const carContainer = document.querySelector('.car-container');
  
  // Debug: Log container and data
  console.log('Display cars called with:', cars);
  console.log('Container found:', carContainer);
  
  if (!carContainer || !Array.isArray(cars)) {
    console.error('Invalid container or cars data');
    return;
  }
  
  carContainer.innerHTML = '';
  
  if (cars.length === 0) {
    carContainer.innerHTML = '<p>No cars found</p>';
    return;
  }

  cars.forEach(car => {
    try {

      console.log('Processing car:', car); // Add logging
      const carElement = document.createElement('div');
      carElement.className = 'car';
      
      const carImages = car.carImages || [];
      const mainImage = carImages[0] || './images/default-car.jpg';
      
      carElement.innerHTML = `
        <div class="car-info">
          <h3>Car Details</h3>
          <div class="car-details">
            <p>🚘 Plate: ${car.carNumberPlate || 'N/A'}</p>
            <p>📍 Location: ${car.location || 'N/A'}</p>
            <p>📞 Contact: ${car.phone || 'N/A'}</p>
            <p>⛽ Consumption: ${car.consumption || 'N/A'} km/l</p>
            <p>🛣️ Mileage: ${car.mileage || 'N/A'} km</p>
          </div>
          ${carImages.length > 1 ? `
            <div class="car-gallery">
              ${carImages.slice(1).map(img => 
                `<img src="${img}" alt="Car view" class="thumbnail">`
              ).join('')}
            </div>
          ` : ''}
        </div>
      `;
      
      carContainer.appendChild(carElement);
      console.log('Successfully added car:', car.carNumberPlate);
    } catch (error) {
      console.error('Error displaying car:', error);
    }
  });
}

// Function to submit a rating
async function submitRating(event) {
  event.preventDefault();
  const form = event.target;
  const driverEmail = form.driverEmail.value;
  const rating = form.rating.value;
  const review = form.review.value;

  try {
    // Show loading state
    Swal.fire({
      title: 'Submitting Rating...',
      didOpen: () => {
        Swal.showLoading();
      }
    });

    const response = await fetch('http://localhost:3000/submit-rating', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ driverEmail, rating, review })
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || 'Failed to submit rating');
    }

    // Show success message
    await Swal.fire({
      icon: 'success',
      title: 'Thank you!',
      text: result.message,
      timer: 2000,
      showConfirmButton: false
    });

    form.reset();
    fetchUserInfo(); // Refresh driver data
  } catch (err) {
    console.error('Error:', err);
    Swal.fire({
      icon: 'error',
      title: 'Rating Failed',
      text: err.message,
      confirmButtonColor: '#3085d6'
    });
  }
}

// Add function for displaying error messages
function showError(message) {
  Swal.fire({
    icon: 'error',
    title: 'Error',
    text: message,
    confirmButtonColor: '#3085d6'
  });
}

// Add function for displaying success messages
function showSuccess(message) {
  Swal.fire({
    icon: 'success',
    title: 'Success',
    text: message,
    timer: 2000,
    showConfirmButton: false
  });
}

document.getElementById('ratingForm').addEventListener('submit', submitRating);

// Code for main menu
const headings = document.querySelectorAll('.menu-headings h2');
const menuHeadings = document.querySelector('.menu-headings');
const contents = document.querySelectorAll('.menu-content > div');

headings.forEach(heading => {
  heading.addEventListener('click', () => {
    const target = heading.getAttribute('data-target');
    
    // Update headings
    headings.forEach(h => h.classList.remove('active'));
    heading.classList.add('active');
    
    // Update content visibility
    contents.forEach(content => {
      if (content.id === target) {
        content.classList.add('active');
      } else {
        content.classList.remove('active');
      }
    });
    
    // Update indicator
    menuHeadings.setAttribute('data-active', target);
  });
});

// Add smooth scrolling for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        document.querySelector(this.getAttribute('href')).scrollIntoView({
            behavior: 'smooth'
        });
    });
});