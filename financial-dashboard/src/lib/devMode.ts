export const isLocalDevMockMode = process.env.NEXT_PUBLIC_LOCAL_DEV_MOCKS === "true"

export const localDevUserId =
  process.env.NEXT_PUBLIC_LOCAL_DEV_USER_ID || "local-dev-user"

export const localDevUserEmail =
  process.env.NEXT_PUBLIC_LOCAL_DEV_USER_EMAIL || "local-dev@gpay.local"
