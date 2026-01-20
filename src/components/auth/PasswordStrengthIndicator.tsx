import { useMemo } from "react";
import { Check, X } from "lucide-react";

interface PasswordStrengthIndicatorProps {
  password: string;
}

export function PasswordStrengthIndicator({ password }: PasswordStrengthIndicatorProps) {
  const checks = useMemo(() => {
    return {
      minLength: password.length >= 8,
      hasUppercase: /[A-Z]/.test(password),
      hasLowercase: /[a-z]/.test(password),
      hasNumber: /[0-9]/.test(password),
      hasSpecial: /[!@#$%^&*(),.?":{}|<>]/.test(password),
    };
  }, [password]);

  const strength = useMemo(() => {
    const passedChecks = Object.values(checks).filter(Boolean).length;
    if (passedChecks === 5) return { label: "Strong", color: "bg-green-500" };
    if (passedChecks >= 3) return { label: "Medium", color: "bg-amber-500" };
    if (passedChecks >= 1) return { label: "Weak", color: "bg-red-500" };
    return { label: "", color: "bg-muted" };
  }, [checks]);

  const passedCount = Object.values(checks).filter(Boolean).length;

  if (!password) return null;

  return (
    <div className="space-y-2 mt-2">
      {/* Strength bar */}
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${
              i <= passedCount ? strength.color : "bg-muted"
            }`}
          />
        ))}
      </div>
      
      {/* Strength label */}
      {strength.label && (
        <p className={`text-xs font-medium ${
          strength.label === "Strong" ? "text-green-600" :
          strength.label === "Medium" ? "text-amber-600" : "text-red-600"
        }`}>
          Password strength: {strength.label}
        </p>
      )}

      {/* Requirements list */}
      <ul className="space-y-1 text-xs">
        <li className={`flex items-center gap-1 ${checks.minLength ? "text-green-600" : "text-muted-foreground"}`}>
          {checks.minLength ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
          At least 8 characters
        </li>
        <li className={`flex items-center gap-1 ${checks.hasUppercase ? "text-green-600" : "text-muted-foreground"}`}>
          {checks.hasUppercase ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
          One uppercase letter
        </li>
        <li className={`flex items-center gap-1 ${checks.hasLowercase ? "text-green-600" : "text-muted-foreground"}`}>
          {checks.hasLowercase ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
          One lowercase letter
        </li>
        <li className={`flex items-center gap-1 ${checks.hasNumber ? "text-green-600" : "text-muted-foreground"}`}>
          {checks.hasNumber ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
          One number
        </li>
        <li className={`flex items-center gap-1 ${checks.hasSpecial ? "text-green-600" : "text-muted-foreground"}`}>
          {checks.hasSpecial ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
          One special character (!@#$%^&*)
        </li>
      </ul>
    </div>
  );
}

export function validatePasswordStrength(password: string): boolean {
  const minLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  
  // Require at least 3 of the 5 criteria (including min length)
  const passedChecks = [minLength, hasUppercase, hasLowercase, hasNumber].filter(Boolean).length;
  return passedChecks >= 3;
}
