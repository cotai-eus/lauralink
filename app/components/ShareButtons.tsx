export function ShareButtons({ url, filename }: { url: string; filename: string }) {
  const encodedUrl = encodeURIComponent(url);
  const text = encodeURIComponent(`Check out: ${filename}`);

  return (
    <div className="flex gap-2">
      <a
        href={`https://twitter.com/intent/tweet?url=${encodedUrl}&text=${text}`}
        target="_blank"
        rel="noopener noreferrer"
        className="p-3 hover:bg-blue-500/20 rounded-lg transition-colors border border-gray-700 hover:border-blue-500"
        title="Share on Twitter"
      >
        <span className="text-xl">𝕏</span>
      </a>

      <a
        href={`https://wa.me/?text=${text}%20${encodedUrl}`}
        target="_blank"
        rel="noopener noreferrer"
        className="p-3 hover:bg-green-500/20 rounded-lg transition-colors border border-gray-700 hover:border-green-500"
        title="Share on WhatsApp"
      >
        <span className="text-xl">💬</span>
      </a>

      <a
        href={`mailto:?subject=${encodeURIComponent(filename)}&body=${encodedUrl}`}
        className="p-3 hover:bg-orange-500/20 rounded-lg transition-colors border border-gray-700 hover:border-orange-500"
        title="Share via Email"
      >
        <span className="text-xl">📧</span>
      </a>

      <a
        href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`}
        target="_blank"
        rel="noopener noreferrer"
        className="p-3 hover:bg-blue-600/20 rounded-lg transition-colors border border-gray-700 hover:border-blue-600"
        title="Share on LinkedIn"
      >
        <span className="text-xl">💼</span>
      </a>
    </div>
  );
}
