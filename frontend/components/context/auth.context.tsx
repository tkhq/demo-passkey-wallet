'use client'

import axios from 'axios';
import { Dispatch, SetStateAction, createContext, useContext, useEffect, useState } from 'react';
import { whoamiUrl } from '@/utils/urls';
import useSWR from 'swr';

type AuthState = {
    isLoaded: boolean,
    isLoggedIn: boolean,
    email: string|null,
    userId: string|null,
}

const initialState: AuthState = {
    isLoaded: false,
    isLoggedIn: false,
    email: null,
    userId: null,
};

async function authStateFetcher(url: string): Promise<AuthState> {
  let response = await axios.get(url, {withCredentials: true})
  if (response.status === 200) {
      return {
          isLoaded: true,
          isLoggedIn: true,
          email: response.data["email"],
          userId: response.data["id"],
      }
  } else if (response.status === 204) {
    // A 204 indicates "no current user"
    return {
      isLoaded: true,
      isLoggedIn: false,
      email: response.data["email"],
      userId: response.data["id"],
    }
  } else {
      // Other status codes indicate an error of some sort
      return initialState
  }
}

export const AuthContext = createContext<{
  state: AuthState;
  setState: Dispatch<SetStateAction<AuthState>>;
}>({
  state: initialState,
  setState: function (value: SetStateAction<AuthState>): void {
    throw new Error('Function not implemented.');
  }
});

export const AuthProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [state, setState] = useState(initialState)

  const { data, error } = useSWR(whoamiUrl(), authStateFetcher)
  if (error) {
      console.error("error while loading auth status!", error);
  }

  useEffect(() => {
      if (data !== undefined) {
          setState(data);
      }
  }, [data])

  return (
    <AuthContext.Provider value={{
      state,
      setState,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
export const AuthConsumer = AuthContext.Consumer;