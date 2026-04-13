import React from "react"

const variants = {
  default: "bg-slate-950 text-white hover:bg-slate-800",
  outline: "border border-slate-200 bg-white text-slate-950 hover:bg-slate-50",
}

export function Button({
  className = "",
  variant = "default",
  asChild = false,
  children,
  ...props
}) {
  const classes = `inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium transition ${variants[variant] || variants.default} ${className}`

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, {
      className: `${classes} ${children.props.className || ""}`.trim(),
      ...props,
    })
  }

  return (
    <button className={classes} {...props}>
      {children}
    </button>
  )
}
