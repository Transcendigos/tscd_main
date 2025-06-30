// frontend/src/dashboard.ts

import { currentUserId as myUserId, currentUsername as myUsername } from './chatClient.js';

// Chart.js is loaded via CDN, so we declare it to TypeScript
declare const Chart: any;

let winLossChart: any = null; // Variable to hold the chart instance

// Function to fetch all dashboard data
export async function fetchData() {
    if (!myUserId) {
        console.error("Dashboard: User not authenticated.");
        return;
    }
    
    const prefixedId = `user_${myUserId}`;

    try {
        // Fetch summary and history in parallel
        const [summaryRes, historyRes] = await Promise.all([
            fetch(`/api/stats/summary/${prefixedId}`),
            fetch(`/api/stats/match-history/${prefixedId}`)
        ]);

        if (!summaryRes.ok || !historyRes.ok) {
            throw new Error('Failed to fetch stats data.');
        }

        const summary = await summaryRes.json();
        const history = await historyRes.json();

        updateDashboardUI(summary, history);

    } catch (error) {
        console.error("Error fetching dashboard data:", error);
    }
}

// Function to update the UI with fetched data
function updateDashboardUI(summary: any, history: any[]) {
    // Update KPI cards
    document.getElementById('dashboard-username')!.textContent = `${myUsername}'s Dashboard`;
    document.getElementById('stats-wins')!.textContent = summary.wins;
    document.getElementById('stats-losses')!.textContent = summary.losses;
    document.getElementById('stats-winRatio')!.textContent = summary.winRatio;
    document.getElementById('stats-tournamentsWon')!.textContent = summary.tournamentsWon;

    // Update or create the Win/Loss chart
    const chartCanvas = document.getElementById('winLossChart') as HTMLCanvasElement;
    if (chartCanvas) {
        if (winLossChart) {
            winLossChart.destroy(); // Destroy old chart before creating a new one
        }
        winLossChart = new Chart(chartCanvas, {
            type: 'doughnut',
            data: {
                labels: ['Wins', 'Losses'],
                datasets: [{
                    data: [summary.wins, summary.losses],
                    backgroundColor: ['#4ade80', '#f87171'],
                    borderColor: '#1e293b',
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                }
            }
        });
    }

    // Update match history table
    const historyBody = document.getElementById('matchHistoryBody');
    if (historyBody) {
        historyBody.innerHTML = ''; // Clear previous history
        if (history.length === 0) {
            historyBody.innerHTML = `<tr><td colspan="4" class="text-center p-4 text-slate-400">No match history found.</td></tr>`;
        } else {
            history.forEach(match => {
                const resultClass = match.result === 'Win' ? 'text-green-400' : 'text-red-400';
                const row = document.createElement('tr');
                row.className = 'border-b border-slate-700/50';
                row.innerHTML = `
                    <td class="p-2">${match.mode}</td>
                    <td class="p-2">${match.opponent}</td>
                    <td class="p-2">${match.yourScore} - ${match.opponentScore}</td>
                    <td class="p-2 font-bold ${resultClass}">${match.result}</td>
                `;
                historyBody.appendChild(row);
            });
        }
    }
}

// Main setup function to be called from main.ts
export function setupDashboard() {
    // The fetchData function will be called when the stats window is opened
    // This is handled in main.ts
}