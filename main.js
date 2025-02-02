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

async function fetchUserInfo() {
  try {
    const response = await fetch('http://localhost:3000/driver-info');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const users = await response.json();
    console.log('Fetched users:', users);
    displayUsers(users);
  } catch (err) {
    console.error('Failed to fetch user info:', err);
  }
}

function displayUsers(users) {
  const userContainer = document.querySelector('.driver-container');
  if (!userContainer) {
    console.error('Element with class "driver-container" not found.');
    return;
  }
  userContainer.innerHTML = '';
  users.forEach(user => {
    console.log('Displaying user:', user);
    const userElement = document.createElement('div');
    userElement.className = 'driver';
    const classes = Object.keys(user.classes).filter(cls => user.classes[cls]).join(', ') || 'N/A';
    const ratings = user.ratings || [];
    const averageRating = ratings.length ? (ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length).toFixed(1) : 'N/A';
    const reviews = ratings.map(r => `<p>${r.user}: ${r.review} (${r.rating}/5)</p>`).join('');
    userElement.innerHTML = `
      <div class="front">
        <h2>${user.name} ${user.lname}</h2>
        <img src="${user.image || 'path/to/default-image.jpg'}" alt="${user.name}">
      </div>
      <div class="back">
        <a href="tel:${user.phone || 'N/A'}">Call: ${user.phone || 'N/A'}</a>
        <a href="mailto:${user.email || 'N/A'}">Email: ${user.email || 'N/A'}</a>
        <span>Experience: ${user.experience || 'N/A'}</span>
        <span>Has Car: ${user.hasCar ? 'Yes' : 'No'}</span>
        <span>Classes: ${classes}</span>
        <span>Country: ${user.country || 'N/A'}</span>
        <span>Location: ${user.location || 'N/A'}</span>
        <span>Age: ${user.age || 'N/A'}</span>
        <span>Rate: ${user.rate || 'N/A'} $/km</span>
        <div class="ratings">
          <span>Average Rating: ${averageRating}</span>
          <div class="reviews">${reviews}</div>
        </div>
      </div>
    `;
    userContainer.appendChild(userElement);
  });
}

// Function to submit a rating
async function submitRating(email, rating, review) {
  try {
    const token = localStorage.getItem('token');
    console.log('Token from local storage:', token); // Log the token for debugging

    const response = await fetch('http://localhost:3000/driver-info', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token // Assuming token is stored in localStorage
      },
      body: JSON.stringify({ email, rating, review })
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const result = await response.json();
    console.log('Rating submitted:', result);
    document.getElementById('ratingForm').reset(); // Reset the form after submission
    fetchUserInfo(); // Refresh the user info to display the new rating
  } catch (err) {
    console.error(err);
  }
}

document.getElementById('ratingForm').addEventListener('submit', function(event) {
  event.preventDefault();
  const email = document.getElementById('driverEmail').value;
  const rating = document.getElementById('rating').value;
  const review = document.getElementById('review').value;
  submitRating(email, rating, review);
});

// Code for main menu
const headings = document.querySelectorAll('.menu-headings h2');
const menuHeadings = document.querySelector('.menu-headings');
const contents = document.querySelectorAll('.menu-content div');

headings.forEach(heading => {
  heading.addEventListener('click', () => {
    const target = heading.getAttribute('data-target');
    // Remove active class from all headings and contents
    headings.forEach(h => h.classList.remove('active'));
    contents.forEach(c => c.classList.remove('active'));
    // Add active class to the clicked heading and content
    heading.classList.add('active');
    document.getElementById(target).classList.add('active');
    // Update the data-active attribute to animate the line
    menuHeadings.setAttribute('data-active', target);
  });
});