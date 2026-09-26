import clsx from "clsx";

export default function Card({ className, children, as: Tag = "div", ...props }) {
  return (
    <Tag
      className={clsx(
        "rounded-2xl bg-white border border-line/70 shadow-card",
        className
      )}
      {...props}
    >
      {children}
    </Tag>
  );
}
