export const useAuth = () => {
  const { api, token } = useApi()
  const user = useState('user', () => null)
  const router = useRouter()

  const login = async (email: string, password: string) => {
    try {
      const data: any = await api('/login', {
        method: 'POST',
        body: { email, password },
      })

      token.value = data.token
      user.value = data.user

      await router.push('/')
    } catch (error: any) {
      throw error
    }
  }

  const guestLogin = async () => {
    try {
      const data: any = await api('/guest-login', {
        method: 'POST',
      })

      token.value = data.token
      user.value = data.user

      await router.push('/')
    } catch (error: any) {
      throw error
    }
  }

  const register = async (name: string, email: string, password: string, password_confirmation: string) => {
    try {
      const data: any = await api('/register', {
        method: 'POST',
        body: { name, email, password, password_confirmation },
      })

      token.value = data.token
      user.value = data.user

      await router.push('/')
    } catch (error: any) {
      throw error
    }
  }

  const logout = async () => {
    try {
      await api('/logout', {
        method: 'POST',
      })
    } catch (error) {
      // Ignore errors on logout
    } finally {
      token.value = null
      user.value = null
      await router.push('/auth/login')
    }
  }

  const fetchUser = async () => {
    if (!token.value) {
      return null
    }

    try {
      const data: any = await api('/me')
      user.value = data
      return data
    } catch (error: any) {
      // トークンが無効な場合はクリアする
      if (error.statusCode === 401) {
        token.value = null
        user.value = null
      }
      return null
    }
  }

  return {
    user,
    login,
    guestLogin,
    register,
    logout,
    fetchUser,
    isAuthenticated: computed(() => !!token.value),
  }
}
