import { h, Fragment } from 'preact'
import { AuthContext, useAuth } from './AuthProvider'
import { Auth } from './Auth'

export function App() {
  const { user, login, logout } = useAuth();

  return (
    <>
    <AuthContext.Provider value={{
      user: user,
      login: login,
      logout: logout,
    }}>
      <Auth />
    </AuthContext.Provider>
    </>
  )
}