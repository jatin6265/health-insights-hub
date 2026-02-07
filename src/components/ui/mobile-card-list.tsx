import * as React from "react";
import { cn } from "@/lib/utils";

interface MobileCardListProps {
  children: React.ReactNode;
  className?: string;
}

export function MobileCardList({ children, className }: MobileCardListProps) {
  return (
    <div className={cn("space-y-3", className)}>
      {children}
    </div>
  );
}

interface MobileCardItemProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export function MobileCardItem({ children, className, onClick }: MobileCardItemProps) {
  return (
    <div 
      className={cn(
        "p-4 border rounded-lg bg-card transition-colors",
        onClick && "cursor-pointer hover:bg-muted/50",
        className
      )}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

interface MobileCardHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export function MobileCardHeader({ 
  title, 
  subtitle, 
  badge, 
  actions,
  className 
}: MobileCardHeaderProps) {
  return (
    <div className={cn("flex items-start justify-between gap-3", className)}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-medium text-foreground truncate">{title}</h3>
          {badge}
        </div>
        {subtitle && (
          <p className="text-sm text-muted-foreground mt-0.5 truncate">{subtitle}</p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2 flex-shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
}

interface MobileCardBodyProps {
  children: React.ReactNode;
  className?: string;
}

export function MobileCardBody({ children, className }: MobileCardBodyProps) {
  return (
    <div className={cn("mt-3 space-y-2 text-sm", className)}>
      {children}
    </div>
  );
}

interface MobileCardRowProps {
  icon?: React.ReactNode;
  label: string;
  value: React.ReactNode;
  className?: string;
}

export function MobileCardRow({ icon, label, value, className }: MobileCardRowProps) {
  return (
    <div className={cn("flex items-center justify-between gap-2", className)}>
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <div className="text-foreground font-medium truncate max-w-[50%] text-right">
        {value}
      </div>
    </div>
  );
}

interface MobileCardActionsProps {
  children: React.ReactNode;
  className?: string;
}

export function MobileCardActions({ children, className }: MobileCardActionsProps) {
  return (
    <div className={cn("mt-4 flex flex-wrap gap-2", className)}>
      {children}
    </div>
  );
}
