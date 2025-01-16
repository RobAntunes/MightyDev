import { Auth0ContextInterface, User } from "@auth0/auth0-react";

export const getAccessToken = async (
  auth0: Auth0ContextInterface<User>
): Promise<string> => {
  try {
    if (!auth0.isAuthenticated) {
      throw new Error('User is not authenticated');
    }

    const token = await auth0.getAccessTokenSilently({
      authorizationParams: {
        scope: "openid profile email",
      }
    });

    return token;
  } catch (error) {
    console.error("Error getting token:", error);
    throw error;
  }
};

export const fetchWithAuth = async (
  url: string,
  options: RequestInit = {},
  auth0: Auth0ContextInterface<User>
): Promise<Response> => {
  try {
    const token = await getAccessToken(auth0);
    
    return fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("Error in fetchWithAuth:", error);
    throw error;
  }
};