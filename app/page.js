const { getCategories, getProducts } = require('../lib/db');
import Storefront from '../components/Storefront';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const categories = await getCategories();
  const products = await getProducts({ activeOnly: true });
  return <Storefront initialCategories={categories} initialProducts={products} />;
}
