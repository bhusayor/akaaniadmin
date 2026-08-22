import { lazy, Suspense } from "react";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import { ToastProvider } from "./components/Toast.jsx";
import { MealsProvider } from "./state/MealsProvider.jsx";
import { BlogsProvider } from "./state/BlogsProvider.jsx";
import { RecipeGroupsProvider } from "./state/RecipeGroupsProvider.jsx";
import { FinanceProvider } from "./state/FinanceProvider.jsx";
import { CustomersProvider } from "./state/CustomersProvider.jsx";
import { IngredientsProvider } from "./state/IngredientsProvider.jsx";
import { MealTagsProvider } from "./state/MealTagsProvider.jsx";
import { LuFactsProvider } from "./state/LuFactsProvider.jsx";
import { SettingsProvider } from "./state/SettingsProvider.jsx";
import { Spinner } from "./components/ui.jsx";
import ChunkBoundary from "./components/ChunkBoundary.jsx";
import Splash from "./pages/Splash.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Customers from "./pages/Customers.jsx";
import Finances from "./pages/Finances.jsx";
import CustomerDetail from "./pages/CustomerDetail.jsx";
import CustomerEdit from "./pages/CustomerEdit.jsx";
import Meals from "./pages/Meals.jsx";
import MealDetail from "./pages/MealDetail.jsx";
import MealEdit from "./pages/MealEdit.jsx";
import Blogs from "./pages/Blogs.jsx";
import BlogPost from "./pages/BlogPost.jsx";
import RecipeGroups from "./pages/RecipeGroups.jsx";
import MealTags from "./pages/MealTags.jsx";
import LuFacts from "./pages/LuFacts.jsx";
import BlogEditor from "./pages/BlogEditor.jsx";
import Settings from "./pages/Settings.jsx";

/* Split out on its own: this route pulls in the 960-food WAFCT dataset,
   which is most of the bundle and is useless to every other page. */
/**
 * Retries a code-split import once before giving up.
 *
 * The usual cause of a failure here is a rebuild landing while the tab was
 * open, and a single retry clears the transient version of that. When it
 * fails twice the error reaches ChunkBoundary, which explains it.
 */
const lazyWithRetry = (load) =>
  lazy(() => load().catch(() => new Promise((resolve, reject) => {
    setTimeout(() => load().then(resolve, reject), 400);
  })));

/* Lazy because this page carries the food database — a third of a megabyte
   that no other page needs. */
const Ingredients = lazyWithRetry(() => import("./pages/Ingredients.jsx"));

const PageLoading = () => (
  <div className="grid flex-1 place-items-center py-20">
    <Spinner className="size-6" />
  </div>
);

/* HashRouter, not BrowserRouter: a built bundle should still work when
   opened straight off disk or served from a sub-path, which is how this
   dashboard has always been used. */
export default function App() {
  return (
    <SettingsProvider>
      <ToastProvider>
      <MealsProvider>
        <BlogsProvider>
          <RecipeGroupsProvider>
            <FinanceProvider>
            <CustomersProvider>
            <IngredientsProvider>
            <MealTagsProvider>
              <LuFactsProvider>
        <HashRouter>
          <Routes>
            <Route path="/" element={<Splash />} />
            <Route element={<Layout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/customers" element={<Customers />} />
              {/* `edit` first — otherwise it matches :id */}
              <Route path="/customers/edit/:id" element={<CustomerEdit />} />
              <Route path="/customers/:id" element={<CustomerDetail />} />
              <Route path="/meals" element={<Meals />} />
              {/* `new` and `edit` first — otherwise they match :id */}
            <Route path="/meals/new" element={<MealEdit />} />
            <Route path="/meals/edit/:id" element={<MealEdit />} />
            <Route path="/meals/:id" element={<MealDetail />} />
            <Route path="/finances" element={<Finances />} />
            <Route path="/recipe-groups" element={<RecipeGroups />} />
            <Route path="/meal-tags" element={<MealTags />} />
            <Route path="/lu-facts" element={<LuFacts />} />
            <Route path="/blogs" element={<Blogs />} />
            {/* `new` before `:id`, same reason as the meal edit route */}
            <Route path="/blogs/new" element={<BlogEditor />} />
            <Route path="/blogs/edit/:id" element={<BlogEditor />} />
            <Route path="/blogs/:id" element={<BlogPost />} />
              <Route
                path="/ingredients"
                element={
                  <ChunkBoundary>
                    <Suspense fallback={<PageLoading />}>
                      <Ingredients />
                    </Suspense>
                  </ChunkBoundary>
                }
              />
              <Route path="/settings" element={<Settings />} />
            </Route>
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </HashRouter>
      </LuFactsProvider>
            </MealTagsProvider>
            </IngredientsProvider>
            </CustomersProvider>
            </FinanceProvider>
          </RecipeGroupsProvider>
        </BlogsProvider>
      </MealsProvider>
      </ToastProvider>
    </SettingsProvider>
  );
}
