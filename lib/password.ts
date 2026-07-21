export type PasswordRequirements = {
  longEnough: boolean;
  hasLetter: boolean;
  hasNumber: boolean;
};

export function getPasswordRequirements(password: string): PasswordRequirements {
  return {
    longEnough: password.length >= 8,
    hasLetter: /[a-z]/i.test(password),
    hasNumber: /\d/.test(password)
  };
}

export function passwordMeetsRequirements(password: string) {
  const requirements = getPasswordRequirements(password);
  return requirements.longEnough && requirements.hasLetter && requirements.hasNumber;
}
