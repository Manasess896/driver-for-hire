const showSuccess = async (message, timer = 3000) => {
    return Swal.fire({
        title: 'Success',
        text: message,
        icon: 'success',
        showConfirmButton: false,
        timer: timer
    });
};

const showError = async (message) => {
    return Swal.fire({
        title: 'Error',
        text: message,
        icon: 'error',
        confirmButtonText: 'OK'
    });
};

const showWarning = async (message) => {
    return Swal.fire({
        title: 'Warning',
        text: message,
        icon: 'warning',
        confirmButtonText: 'OK'
    });
};

const showConfirm = async (message) => {
    return Swal.fire({
        title: 'Are you sure?',
        text: message,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Yes',
        cancelButtonText: 'No'
    });
};

// Network error handler
window.addEventListener('offline', () => {
    Swal.fire({
        title: 'No Internet Connection',
        text: 'Please check your connection and try again.',
        icon: 'warning',
        confirmButtonText: 'OK'
    });
});
