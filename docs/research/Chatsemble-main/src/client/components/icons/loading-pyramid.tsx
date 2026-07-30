interface AnimatedPyramidIconProps
	extends Omit<
		React.SVGProps<SVGSVGElement>,
		"width" | "height" | "viewBox" | "color"
	> {
	// Exclude color prop as it's internally set
	/** Animation duration in seconds (e.g., "3s") */
	duration?: string;
	/** Radius of the spheres */
	sphereRadius?: number;
}

/**
 * An animated SVG icon showing 3 spheres in a pyramid formation,
 * cycling through positions and using the current CSS color.
 * Size is controlled externally via CSS/Tailwind classes.
 */
export function AnimatedPyramidIcon({
	duration = "3s",
	sphereRadius = 20,
	...props
}: AnimatedPyramidIconProps) {
	const topPos = { x: 50, y: sphereRadius };
	const bottomLeftPos = { x: sphereRadius, y: 100 - sphereRadius };
	const bottomRightPos = { x: 100 - sphereRadius, y: 100 - sphereRadius };

	const path1to2 = `M 0 0 L ${bottomLeftPos.x - topPos.x} ${bottomLeftPos.y - topPos.y}`;
	const path2to3 = `M 0 0 L ${bottomRightPos.x - bottomLeftPos.x} ${bottomRightPos.y - bottomLeftPos.y}`;
	const path3to1 = `M 0 0 L ${topPos.x - bottomRightPos.x} ${topPos.y - bottomRightPos.y}`;

	return (
		<svg
			viewBox="0 0 100 100"
			xmlns="http://www.w3.org/2000/svg"
			color="currentColor" // Explicitly set color for inheritance
			preserveAspectRatio="xMidYMid meet"
			fill="currentColor" // Set default fill for children
			{...props} // Pass className, style, id etc.
		>
			<title>Loading Pyramid</title>

			<circle cx={topPos.x} cy={topPos.y} r={sphereRadius}>
				<animateMotion
					path={path1to2}
					dur={duration}
					repeatCount="indefinite"
					calcMode="linear"
				/>
			</circle>

			<circle cx={bottomLeftPos.x} cy={bottomLeftPos.y} r={sphereRadius}>
				<animateMotion
					path={path2to3}
					dur={duration}
					repeatCount="indefinite"
					calcMode="linear"
				/>
			</circle>

			<circle cx={bottomRightPos.x} cy={bottomRightPos.y} r={sphereRadius}>
				<animateMotion
					path={path3to1}
					dur={duration}
					repeatCount="indefinite"
					calcMode="linear"
				/>
			</circle>
		</svg>
	);
}
