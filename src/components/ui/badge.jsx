const variants = {
  default: "bg-slate-950 text-white",
  outline: "border border-slate-300 bg-white text-slate-950",
  secondary: "bg-slate-100 text-slate-700",
}

export function Badge({ className = "", variant = "default", ...props }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${variants[variant] || variants.default} ${className}`}
      {...props}
    />
  )
}
