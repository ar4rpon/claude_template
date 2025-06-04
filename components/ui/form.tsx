import * as React from "react"
import { cn } from "@/lib/utils"

interface FormContextValue {
  errors: Record<string, string[]>
  isSubmitting: boolean
}

const FormContext = React.createContext<FormContextValue>({
  errors: {},
  isSubmitting: false,
})

interface FormProps extends React.FormHTMLAttributes<HTMLFormElement> {
  errors?: Record<string, string[]>
  isSubmitting?: boolean
}

/**
 * Form component that provides error handling context to form fields
 * @param errors - Object containing field errors
 * @param isSubmitting - Whether the form is currently being submitted
 */
const Form = React.forwardRef<HTMLFormElement, FormProps>(
  ({ className, errors = {}, isSubmitting = false, children, ...props }, ref) => {
    const contextValue = React.useMemo(
      () => ({ errors, isSubmitting }),
      [errors, isSubmitting]
    )

    return (
      <FormContext.Provider value={contextValue}>
        <form
          ref={ref}
          className={cn("space-y-4", className)}
          {...props}
        >
          {children}
        </form>
      </FormContext.Provider>
    )
  }
)
Form.displayName = "Form"

/**
 * Form field wrapper that provides consistent spacing and error handling
 */
const FormField = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("space-y-2", className)} {...props} />
))
FormField.displayName = "FormField"

/**
 * Form label component with consistent styling
 */
const FormLabel = React.forwardRef<
  HTMLLabelElement,
  React.LabelHTMLAttributes<HTMLLabelElement>
>(({ className, ...props }, ref) => (
  <label
    ref={ref}
    className={cn(
      "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
      className
    )}
    {...props}
  />
))
FormLabel.displayName = "FormLabel"

interface FormErrorProps extends React.HTMLAttributes<HTMLParagraphElement> {
  name: string
}

/**
 * Form error display component that shows field-specific errors
 * @param name - The name of the form field to show errors for
 */
const FormError = React.forwardRef<HTMLParagraphElement, FormErrorProps>(
  ({ className, name, ...props }, ref) => {
    const { errors } = React.useContext(FormContext)
    const fieldErrors = errors[name]

    if (!fieldErrors || fieldErrors.length === 0) {
      return null
    }

    return (
      <p
        ref={ref}
        className={cn("text-sm text-destructive", className)}
        {...props}
      >
        {fieldErrors[0]}
      </p>
    )
  }
)
FormError.displayName = "FormError"

/**
 * Form description component for providing help text
 */
const FormDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
FormDescription.displayName = "FormDescription"

export { Form, FormField, FormLabel, FormError, FormDescription }