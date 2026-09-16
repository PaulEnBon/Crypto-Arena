import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { RegisterForm } from '@/components/auth/RegisterForm';
import { Card } from '@/components/ui/Card';
import { useToast } from '@/context/ToastContext';
import { useAuth } from '@/hooks/useAuth';
import type { RegisterPayload } from '@/types';

export function RegisterPage() {
  const { register, error, clearError } = useAuth();
  const { notify } = useToast();
  const navigate = useNavigate();

  useEffect(() => () => clearError(), [clearError]);

  const handleSubmit = async (payload: RegisterPayload) => {
    await register(payload);
    notify({
      type: 'success',
      title: 'Compte créé',
      message: '10 000 € virtuels ont été crédités sur votre portefeuille. Bon trading !',
    });
    navigate('/dashboard', { replace: true });
  };

  return (
    <Card title="Créer un compte" subtitle="Recevez 10 000 € virtuels et affrontez les autres joueurs.">
      <RegisterForm onSubmit={handleSubmit} serverError={error} />
      <p className="mt-6 text-center text-sm text-ink-400">
        Déjà inscrit ?{' '}
        <Link to="/login" className="font-medium text-accent-300 hover:underline">
          Se connecter
        </Link>
      </p>
    </Card>
  );
}
