export default function AppLogo({ size = 32, className = '' }) {
  return (
    <img
      src="/logo.png"
      alt="My Book Lab"
      width={size}
      height={size}
      className={`rounded-lg ${className}`}
    />
  )
}
