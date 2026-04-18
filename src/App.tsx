import { BrazilMap } from "./components/BrazilMap";
import { mockProjectData } from "./data/mock-projects";

function App() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 text-center mb-2">
          Mapa de Projetos — Brasil
        </h1>
        <p className="text-sm text-zinc-500 text-center mb-6">
          Clique em um estado para ver detalhes por município
        </p>
        <BrazilMap data={mockProjectData} />
      </div>
    </div>
  );
}

export default App;
