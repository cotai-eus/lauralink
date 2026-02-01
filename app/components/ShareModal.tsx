import { useState } from "react";
import { useToast } from "./Toast";

interface ShareModalProps {
  url: string;
  filename: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ShareModal({ url, filename, isOpen, onClose }: ShareModalProps) {
  const { showToast } = useToast();
  const [copied, setCopied] = useState(false);

  const shareOptions = [
    {
      name: "WhatsApp",
      icon: "💬",
      action: () => {
        const text = encodeURIComponent(`Check out: ${filename}\n${url}`);
        window.open(`https://wa.me/?text=${text}`, "_blank");
      },
    },
    {
      name: "Twitter",
      icon: "𝕏",
      action: () => {
        const text = encodeURIComponent(`Check out: ${filename}`);
        window.open(
          `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${text}`,
          "_blank"
        );
      },
    },
    {
      name: "Email",
      icon: "📧",
      action: () => {
        window.location.href = `mailto:?subject=${encodeURIComponent(filename)}&body=${encodeURIComponent(url)}`;
      },
    },
    {
      name: "LinkedIn",
      icon: "💼",
      action: () => {
        window.open(
          `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
          "_blank"
        );
      },
    },
  ];

  const handleWebShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: filename,
          text: `Check out: ${filename}`,
          url: url,
        });
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          showToast("Share failed", "error");
        }
      }
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      showToast("Link copied to clipboard!", "success");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast("Failed to copy link", "error");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-sm max-h-[90vh] sm:max-h-none overflow-y-auto border border-gray-700 border-b-0 sm:border-b animate-fadeIn">
        <div className="sticky top-0 bg-gray-800 flex justify-between items-center mb-6 p-6 border-b border-gray-700">
          <h2 className="text-xl font-bold text-white">Share File</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-700 transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Web Share API Button (Mobile) */}
          {typeof navigator !== "undefined" && "share" in navigator && (
            <button
              onClick={handleWebShare}
              className="w-full mb-4 py-3 px-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold rounded-lg hover:shadow-lg hover:shadow-purple-500/50 transition-all transform hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
            >
              <span className="text-xl">📤</span>
              Native Share
            </button>
          )}

          {/* Social Share Options */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            {shareOptions.map((option) => (
              <button
                key={option.name}
                onClick={option.action}
                className="py-3 px-4 bg-gray-700/50 hover:bg-gray-600 active:bg-gray-500 rounded-lg transition-colors border border-gray-600 hover:border-purple-500 flex flex-col items-center gap-2 group"
                title={option.name}
              >
                <span className="text-2xl group-hover:scale-110 transition-transform">
                  {option.icon}
                </span>
                <span className="text-xs text-gray-300 group-hover:text-white">
                  {option.name}
                </span>
              </button>
            ))}
          </div>

          {/* Copy Link Button */}
          <button
            onClick={handleCopyLink}
            className={`w-full py-3 px-4 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 ${
              copied
                ? "bg-green-500/20 text-green-400 border border-green-500"
                : "bg-gray-700/50 text-gray-300 border border-gray-600 hover:bg-gray-600 hover:border-gray-500 active:bg-gray-500"
            }`}
          >
            <span className="text-lg">{copied ? "✓" : "🔗"}</span>
            {copied ? "Copied!" : "Copy Link"}
          </button>

          {/* QR Code Info */}
          <p className="text-xs text-gray-500 text-center mt-4">
            💡 Use the QR code button to share visually
          </p>
        </div>
      </div>
    </div>
  );
}
