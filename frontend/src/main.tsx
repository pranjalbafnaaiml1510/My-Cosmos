import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import "./index.css";
import { TaxonomyProvider } from "./hooks/useTaxonomy";
import { AppShell } from "./layouts/AppShell";
import { AssistantPage } from "./pages/AssistantPage";
import { ComingSoonPage } from "./pages/ComingSoonPage";
import { EntityPage } from "./pages/EntityPage";
import { CountriesIndexPage, MissionsIndexPage, TopicsIndexPage } from "./pages/IndexPages";
import { ExplorePage } from "./pages/ExplorePage";
import { OpportunitiesPage } from "./pages/OpportunitiesPage";
import { PaperPage } from "./pages/PaperPage";
import { PapersPage } from "./pages/PapersPage";
import { ResearchMapPage } from "./pages/ResearchMapPage";
import { SearchPage } from "./pages/SearchPage";
import { TrendsPage } from "./pages/TrendsPage";

const soon = (title: string, stage: string) => <ComingSoonPage title={title} stage={stage} />;

const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { path: "/", element: <ExplorePage /> },
      { path: "/search", element: <SearchPage /> },
      { path: "/papers", element: <PapersPage /> },
      { path: "/papers/:id", element: <PaperPage /> },
      { path: "/topics", element: <TopicsIndexPage /> },
      { path: "/topics/:id", element: <EntityPage key="topic" kind="topic" /> },
      { path: "/countries", element: <CountriesIndexPage /> },
      { path: "/countries/:id", element: <EntityPage key="country" kind="country" /> },
      { path: "/missions", element: <MissionsIndexPage /> },
      { path: "/missions/:id", element: <EntityPage key="mission" kind="mission" /> },
      { path: "/map", element: <ResearchMapPage /> },
      { path: "/trends", element: <TrendsPage /> },
      { path: "/opportunities", element: <OpportunitiesPage /> },
      { path: "/assistant", element: <AssistantPage /> },
      { path: "*", element: soon("Lost in space", "404") },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <TaxonomyProvider>
      <RouterProvider router={router} />
    </TaxonomyProvider>
  </React.StrictMode>,
);
