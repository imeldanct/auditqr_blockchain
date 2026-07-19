const TOAST_ERROR_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24"><path d="M0 0h24v24H0z" fill="none"/><path fill="currentColor" d="M12.713 16.713Q13 16.425 13 16t-.288-.712T12 15t-.712.288T11 16t.288.713T12 17t.713-.288M11 13h2V7h-2zm1 9q-2.075 0-3.9-.788t-3.175-2.137T2.788 15.9T2 12t.788-3.9t2.137-3.175T8.1 2.788T12 2t3.9.788t3.175 2.137T21.213 8.1T22 12t-.788 3.9t-2.137 3.175t-3.175 2.138T12 22m0-2q3.35 0 5.675-2.325T20 12t-2.325-5.675T12 4T6.325 6.325T4 12t2.325 5.675T12 20m0-8"/></svg>';
const TOAST_CHECK_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24"><path d="M0 0h24v24H0z" fill="none"/><path fill="currentColor" d="m10.6 16.6l7.05-7.05l-1.4-1.4l-5.65 5.65l-2.85-2.85l-1.4 1.4zM12 22q-2.075 0-3.9-.788t-3.175-2.137T2.788 15.9T2 12t.788-3.9t2.137-3.175T8.1 2.788T12 2t3.9.788t3.175 2.137T21.213 8.1T22 12t-.788 3.9t-2.137 3.175t-3.175 2.138T12 22m0-2q3.35 0 5.675-2.325T20 12t-2.325-5.675T12 4T6.325 6.325T4 12t2.325 5.675T12 20m0-8"/></svg>';
const TOAST_CLOSE_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24"><path d="M0 0h24v24H0z" fill="none"/><path fill="currentColor" d="M6.4 19L5 17.6l5.6-5.6L5 6.4L6.4 5l5.6 5.6L17.6 5L19 6.4L13.4 12l5.6 5.6l-1.4 1.4l-5.6-5.6z"/></svg>';

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
    const icon = isError ? TOAST_ERROR_SVG : TOAST_CHECK_SVG;
    const iconColor = isError ? 'text-red-500' : 'text-[#3185FC]';
    const title = isError ? 'Error' : 'Notification';

    toast.className = `pointer-events-auto relative w-full bg-[#1A1A1A] border-l-4 ${borderColor} rounded-md shadow-xl overflow-hidden flex flex-col transition-all duration-300 ease-out transform translate-x-[120%] opacity-0`;

    toast.innerHTML = `
        <div class="px-4 py-3 flex gap-3 pb-4">
            <span class="${iconColor} text-[20px] mt-0.5">${icon}</span>
            <div class="flex-1">
                <p class="font-body text-[14px] text-white font-medium">${title}</p>
                <p class="font-body text-[13px] text-gray-400 mt-1 leading-relaxed">${message}</p>
            </div>
            <button class="text-gray-400 hover:text-white transition-colors focus:outline-none flex-shrink-0 mt-0.5">
                <span class="text-[18px]">${TOAST_CLOSE_SVG}</span>
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
