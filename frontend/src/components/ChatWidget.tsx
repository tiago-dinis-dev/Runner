import { useState } from 'react';

const VSCODE_URI = 'vscode://GitHub.copilot-chat/chat';

export default function ChatWidget() {
  const [hovered, setHovered] = useState(false);

  const handleOpen = () => {
    window.location.href = VSCODE_URI;
  };

  return (
    <div className="fixed bottom-6 right-6 flex flex-col items-end gap-2 z-50">
      {hovered && (
        <div className="bg-gray-900 text-white text-sm px-3 py-2 rounded-xl shadow-lg whitespace-nowrap border border-purple-500/30">
          Chat with your running coach
        </div>
      )}
      <button
        onClick={handleOpen}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="w-14 h-14 rounded-full bg-purple-600 hover:bg-purple-500 transition-colors duration-200 shadow-lg shadow-purple-900/40 flex items-center justify-center cursor-pointer"
        aria-label="Open Copilot coach chat"
      >
        {/* Copilot-style icon */}
        <svg viewBox="0 0 24 24" fill="none" className="w-7 h-7" aria-hidden="true">
          <path
            d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.956 9.956 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2z"
            fill="white"
            opacity="0.15"
          />
          <circle cx="9" cy="12" r="1.5" fill="white" />
          <circle cx="12" cy="12" r="1.5" fill="white" />
          <circle cx="15" cy="12" r="1.5" fill="white" />
        </svg>
      </button>
    </div>
  );
}
