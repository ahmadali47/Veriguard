// ============= AUTHENTICATION SYSTEM =============
document.addEventListener('DOMContentLoaded', function() {
  // Check if we're on the login page
  const isLoginPage = window.location.pathname.includes('login.html');
  
  // If not logged in and not on login page, redirect to login
  if (!isLoggedIn() && !isLoginPage) {
    redirectToLogin();
    return;
  }

  // If on login page, set up the login form
  if (isLoginPage) {
    setupLoginForm();
  } else {
    // On other pages, verify token and add logout button
    verifyToken();

    const logoutBtn = document.querySelector('.logout-button');
    logoutBtn.addEventListener('click', logout);
    // addLogoutButton();
  }
});

// Check if user is logged in
function isLoggedIn() {
  return localStorage.getItem('veriguard_token') !== null;
}

// Set up login form
function setupLoginForm() {
  const loginForm = document.getElementById('loginForm');
  if (!loginForm) return;

  loginForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorElement = document.getElementById('loginError');

    try {
      // Make POST request to login endpoint
      const response = await fetch('http://localhost:5000/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Store token and redirect
        localStorage.setItem('veriguard_token', data.token);
        window.location.href = 'index.html';
      } else {
        // Show error message
        showError(errorElement, data.error || 'Invalid credentials');
      }
    } catch (error) {
      showError(errorElement, 'Network error. Please try again.');
    }
  });
}

// ============= PROPER TOKEN VERIFICATION =============
async function verifyToken() {
  // 1. Get token from storage
  const token = localStorage.getItem('veriguard_token');
  
  // 2. If no token exists, force logout
  if (!token) {
    console.warn('No token found - redirecting to login');
    // logout();
    return false;
  }

  try {
    // 3. Verify token with server
    const response = await fetch('http://localhost:5000/api/protected', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    // 4. Handle response
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Token verification failed');
    }

    // 5. If valid, return user data
    const data = await response.json();
    return data.user; // Or whatever your API returns

  } catch (error) {
    console.error('Token verification error:', error.message);
    // logout();
    return false;
  }
}


// const logoutBtn = document.querySelector('.logout-button');
// logoutBtn.addEventListener('click', logout);

// Logout function
function logout() {
  console.log("logout function click");
  localStorage.removeItem('veriguard_token');
  redirectToLogin();
}

// Redirect to login page
function redirectToLogin() {
  if (!window.location.pathname.includes('login.html')) {
    window.location.href = 'login.html';
  }
}

// Show error message
function showError(element, message) {
  if (!element) return;
  element.textContent = message;
  element.style.display = 'block';
}