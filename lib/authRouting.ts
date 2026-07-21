export const PASSWORD_SETUP_METADATA_KEY = "password_setup_required";

type UserMetadataCarrier = {
  user_metadata?: Record<string, unknown>;
};

export function userNeedsPasswordSetup(user?: UserMetadataCarrier | null) {
  return user?.user_metadata?.[PASSWORD_SETUP_METADATA_KEY] === true;
}
