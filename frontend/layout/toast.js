function showToast(message, type = 'error', duration = 5000) {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'fixed top-4 right-4 z-50 flex flex-col gap-3 min-w-[320px] max-w-[400px] items-end pointer-events-none text-left';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    const isError = type === 'error';
    const borderColor = isError ? 'border-red-500' : 'border-[#3185FC]';
    const progressColor = isError ? 'bg-red-500' : 'bg-[#3185FC]';
    const icon = isError ? 'error' : 'check_circle';
    const iconColor = isError ? 'text-red-500' : 'text-[#3185FC]';
    const title = isError ? 'Error' : 'Notification';

    toast.className = `pointer-events-auto relative w-full bg-[#1A1A1A] border-l-4 ${borderColor} rounded-md shadow-xl overflow-hidden flex flex-col transition-all duration-300 ease-out transform translate-x-[120%] opacity-0`;
    
    toast.innerHTML = `
        <div class="px-4 py-3 flex gap-3 pb-4">
            <span class="material-symbols-outlined ${iconColor} text-[20px] mt-0.5">${icon}</span>
            <div class="flex-1">
                <p class="font-body text-[14px] text-white font-medium">${title}</p>
                <p class="font-body text-[13px] text-gray-400 mt-1 leading-relaxed">${message}</p>
            </div>
            <button class="text-gray-400 hover:text-white transition-colors focus:outline-none flex-shrink-0 mt-0.5">
                <span class="material-symbols-outlined text-[18px]">close</span>
            </button>
        </div>
        <div class="absolute bottom-0 left-0 h-1 ${progressColor} animate-toast-progress" style="animation-duration: ${duration}ms;"></div>
    `;

    container.appendChild(toast);

    requestAnimationFrame(() => {
        toast.classList.remove('translate-x-[120%]', 'opacity-0');
        toast.classList.add('translate-x-0', 'opacity-100');
    });

    const closeBtn = toast.querySelector('button');
    
    let hideTimeout = setTimeout(() => {
        closeToast(toast);
    }, duration);

    closeBtn.onclick = () => {
        clearTimeout(hideTimeout);
        closeToast(toast);
    };
}

function closeToast(toast) {
    toast.classList.remove('translate-x-0', 'opacity-100');
    toast.classList.add('translate-x-[120%]', 'opacity-0');
    toast.addEventListener('transitionend', () => {
        if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
        }
    });
}
window.showToast = showToast;
