import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
const { verifySession, COOKIE_NAME } = require('../../../lib/auth');
const { getCategories, getProducts, getOrders, getAllReviews } = require('../../../lib/db');
import AdminDashboard from '../../../components/AdminDashboard';

export const dynamic = 'force-dynamic';

export default async function AdminDashboardPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  const session = token ? verifySession(token) : null;

  if (!session) {
    redirect('/admin/login');
  }

  const [categories, products, orders, reviews] = await Promise.all([
    getCategories(),
    getProducts({ activeOnly: false }),
    getOrders(),
    getAllReviews(),
  ]);

  return (
    <AdminDashboard
      initialCategories={categories}
      initialProducts={products}
      initialOrders={orders}
      initialReviews={reviews}
      adminUsername={session.username}
    />
  );
}
