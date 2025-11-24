import React, { useState, useEffect } from 'react';

const Dashboard = ({ instanceData, onDeploy, onDelete, onSchedule, isDeploying, isDeleting, deployLogs }) => {
    const [repoUrl, setRepoUrl] = useState('https://github.com/docker/awesome-compose.git');
    const [branch, setBranch] = useState('main');
    const [scheduleMinutes, setScheduleMinutes] = useState(60);
    const [terminationTime, setTerminationTime] = useState(null);
    const [timeLeft, setTimeLeft] = useState(null);

    const handleDeploy = () => {
        onDeploy(repoUrl, branch);
    };

    const handleDelete = () => {
        if (window.confirm('Are you sure you want to terminate this instance? This action cannot be undone.')) {
            onDelete();
        }
    };

    const handleSchedule = () => {
        if (window.confirm(`Schedule termination in ${scheduleMinutes} minutes?`)) {
            const now = new Date();
            const termTime = new Date(now.getTime() + scheduleMinutes * 60000);
            setTerminationTime(termTime);
            onSchedule(scheduleMinutes);
        }
    };

    useEffect(() => {
        if (!terminationTime) return;

        const interval = setInterval(() => {
            const now = new Date();
            const diff = terminationTime - now;

            if (diff <= 0) {
                setTimeLeft("Terminating...");
                clearInterval(interval);
            } else {
                const minutes = Math.floor(diff / 60000);
                const seconds = Math.floor((diff % 60000) / 1000);
                setTimeLeft(`${minutes}m ${seconds}s`);
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [terminationTime]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Instance Status Card */}
            <div className="glass-panel status-card">
                <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Instance Status: <span style={{ color: 'var(--success)' }}>Running</span></h2>
                <div className="grid-2">
                    <div>
                        <p style={{ color: 'var(--text-secondary)' }}>Instance ID</p>
                        <p className="mono">{instanceData.instance_id}</p>
                    </div>
                    <div>
                        <p style={{ color: 'var(--text-secondary)' }}>Public IP</p>
                        <p className="mono" style={{ color: 'var(--accent-primary)' }}>{instanceData.public_ip}</p>
                    </div>
                    <div>
                        <p style={{ color: 'var(--text-secondary)' }}>OS Type</p>
                        <p className="mono">{instanceData.os_type || 'ubuntu'}</p>
                    </div>
                </div>
            </div>

            {/* Deployment Section */}
            <div className="glass-panel">
                <h2 className="text-2xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Deploy Application</h2>
                <div className="form-group">
                    <label>Git Repository URL</label>
                    <input
                        type="text"
                        value={repoUrl}
                        onChange={(e) => setRepoUrl(e.target.value)}
                        placeholder="https://github.com/username/repo.git"
                    />
                </div>
                <div className="form-group">
                    <label>Branch Name</label>
                    <input
                        type="text"
                        value={branch}
                        onChange={(e) => setBranch(e.target.value)}
                        placeholder="main"
                    />
                </div>
                <button
                    onClick={handleDeploy}
                    disabled={isDeploying}
                    className="btn btn-deploy"
                >
                    {isDeploying ? 'Deploying...' : 'Deploy Application'}
                </button>
            </div>

            {/* Danger Zone */}
            <div className="glass-panel" style={{ borderColor: 'var(--error)' }}>
                <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--error)' }}>Danger Zone</h2>

                <div className="form-group" style={{ marginBottom: '1rem' }}>
                    <label style={{ color: 'var(--text-secondary)' }}>Schedule Destruction (Minutes)</label>
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                        <input
                            type="number"
                            value={scheduleMinutes}
                            onChange={(e) => setScheduleMinutes(parseInt(e.target.value))}
                            style={{ width: '100px' }}
                        />
                        <button
                            onClick={handleSchedule}
                            className="btn"
                            style={{ background: 'var(--accent-secondary)', width: 'auto' }}
                        >
                            Schedule
                        </button>
                        {timeLeft && (
                            <span style={{ marginLeft: '1rem', color: 'var(--warning)', fontWeight: 'bold' }}>
                                Time Left: {timeLeft}
                            </span>
                        )}
                    </div>
                </div>

                <button
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="btn"
                    style={{ background: 'var(--error)' }}
                >
                    {isDeleting ? 'Terminating...' : 'Terminate Instance'}
                </button>
            </div>

            {/* Logs Console */}
            <div className="logs">
                <h3 style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem', fontSize: '0.75rem', textTransform: 'uppercase' }}>Deployment Logs</h3>
                {deployLogs.length === 0 ? (
                    <p style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>Waiting for deployment...</p>
                ) : (
                    deployLogs.map((log, index) => (
                        <div key={index} className="log-entry">
                            {log}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default Dashboard;
