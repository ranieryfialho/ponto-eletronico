import React, { useState } from 'react';
import { auth } from '../firebase-config';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';

export function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false); 
  const [isForgotPassword, setIsForgotPassword] = useState(false);

  const handleSignIn = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      if (err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
        setError('E-mail ou senha inválidos.');
      } else {
        setError('Ocorreu um erro ao tentar fazer o login.');
      }
      console.error(err);
    }
  };

  const handlePasswordReset = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    if (!email) {
      setError("Por favor, insira seu e-mail para redefinir a senha.");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      setMessage("E-mail de redefinição de senha enviado. Verifique sua caixa de entrada.");
      setIsForgotPassword(false);
    } catch (error) {
      setError("Não foi possível enviar o e-mail. Verifique se o e-mail está correto.");
      console.error("Erro ao redefinir senha:", error);
    }
  };

  const mainAction = isForgotPassword ? handlePasswordReset : handleSignIn;

  return (
    <form onSubmit={mainAction} className="w-full max-w-sm flex flex-col items-center justify-center p-8 bg-white rounded-lg shadow-xl">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">
        {isForgotPassword ? 'Redefinir Senha' : 'Login do Funcionário'}
      </h2>

      {message && <p className="text-green-600 text-sm mb-4 text-center">{message}</p>}

      <input
        type="email"
        placeholder="Seu e-mail"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full p-3 mb-4 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      {!isForgotPassword && (
        <div className="relative w-full">
          <input
            type={showPassword ? "text" : "password"}
            placeholder="Sua senha"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-3 mb-4 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-500 hover:text-gray-700"
            style={{ top: '-0.5rem' }}
          >
            {showPassword ? (
              <EyeSlashIcon className="h-5 w-5" />
            ) : (
              <EyeIcon className="h-5 w-5" />
            )}
          </button>
        </div>
      )}

      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
      
      <button type="submit" className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-4 rounded-lg transition duration-300">
        {isForgotPassword ? 'Enviar Link de Redefinição' : 'Entrar'}
      </button>

      <button 
        type="button"
        onClick={() => {
          setIsForgotPassword(!isForgotPassword);
          setError('');
          setMessage('');
        }}
        className="mt-4 text-sm text-blue-600 hover:underline"
      >
        {isForgotPassword ? 'Voltar para o Login' : 'Esqueceu a senha?'}
      </button>
    </form>
  );
}