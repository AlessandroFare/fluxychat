export function dateToPrettyTimeAgo(date: Date) {
	const now = new Date();
	const diff = now.getTime() - date.getTime();
	const diffMinutes = Math.floor(diff / (1000 * 60));

	if (diffMinutes < 60) {
		return `${diffMinutes} minutes ago`;
	}

	const diffHours = Math.floor(diff / (1000 * 60 * 60));

	if (diffHours < 24) {
		return `${diffHours} hours ago`;
	}

	const diffDays = Math.floor(diff / (1000 * 60 * 60 * 24));

	if (diffDays < 30) {
		return `${diffDays} days ago`;
	}

	const diffMonths = Math.floor(diff / (1000 * 60 * 60 * 24 * 30));

	if (diffMonths < 12) {
		return `${diffMonths} months ago`;
	}

	const diffYears = Math.floor(diff / (1000 * 60 * 60 * 24 * 30 * 12));

	return `${diffYears} years ago`;
}
