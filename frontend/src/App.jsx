import React, { useState, useEffect } from 'react';
import { Terminal as TerminalIcon, Server, Cloud, Shield, Play, Trash2, Activity, Github, CheckCircle, FileEdit, RefreshCw } from 'lucide-react';
import { createEC2, deployApp, deleteEC2, scheduleTermination, gitPull, executeCommand, readFile, writeFile, cloneRepos, startDeploy } from './api';
import './index.css';

export default function App() {
  // State
  const [awsConfig, setAwsConfig] = useState(() => {
    const saved = localStorage.getItem('awsConfig');
    return saved ? JSON.parse(saved) : {
      accessKey: '',
      secretKey: '',
      region: 'us-east-1',
      osType: 'ubuntu',
      instanceType: 't2.micro',
      allowedPorts: '80, 443, 22, 3000, 8000'
    };
  });
  const [repoList, setRepoList] = useState(() => {
    const saved = localStorage.getItem('repoList');
    if (saved) return JSON.parse(saved);
    // Migration from old repoConfig
    const oldConfig = localStorage.getItem('repoConfig');
    return oldConfig ? [{ ...JSON.parse(oldConfig), path: '.', composePath: '.', frontendPath: '', backendPath: '', id: Date.now() }] : [{ url: 'https://github.com/dockersamples/linux_tweet_app.git', branch: 'main', path: '.', composePath: '.', frontendPath: '', backendPath: '', id: Date.now() }];
  });

  const [envVars, setEnvVars] = useState(() => {
    const saved = localStorage.getItem('envVars');
    return saved ? JSON.parse(saved) : [];
  });
  const [instanceData, setInstanceData] = useState(() => {
    const saved = localStorage.getItem('instanceData');
    return saved ? JSON.parse(saved) : null;
  });
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentStep, setCurrentStep] = useState(() => {
    const saved = localStorage.getItem('currentStep');
    return saved ? parseInt(saved, 10) : 0;
  }); // 0: Config, 1: Creating, 2: Ready, 3: Deploying, 4: Live

  // Timer State
  const [scheduleMinutes, setScheduleMinutes] = useState(60);
  const [terminationTime, setTerminationTime] = useState(null);
  const [timeLeft, setTimeLeft] = useState('');

  // Terminal State
  const [terminalInput, setTerminalInput] = useState('');
  const [terminalHistory, setTerminalHistory] = useState([]);
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [fullScreenTerminal, setFullScreenTerminal] = useState(false);

  // File Editor State
  const [fileEditorOpen, setFileEditorOpen] = useState(false);
  const [filePath, setFilePath] = useState('.env');
  const [fileContent, setFileContent] = useState('');
  const [fileLoading, setFileLoading] = useState(false);

  // Terminate Modal and Notifications
  const [showTerminateModal, setShowTerminateModal] = useState(false);
  const [notification, setNotification] = useState(null); // { type: 'success' | 'error', message: '' }

  // Clear notification after 3 seconds
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Clear terminal history when instance changes
  useEffect(() => {
    setTerminalHistory([]);
    setTerminalInput('');
  }, [instanceData?.instance_id]);

  // Handlers
  const handleCreateServer = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setLogs(prev => [...prev, '> Initializing EC2 creation sequence...']);

    try {
      const ports = awsConfig.allowedPorts.split(',').map(p => parseInt(p.trim())).filter(p => !isNaN(p));

      const result = await createEC2({
        access_key: awsConfig.accessKey,
        secret_key: awsConfig.secretKey,
        region: awsConfig.region,
        os_type: awsConfig.osType,
        instance_type: awsConfig.instanceType,
        allowed_ports: ports.length > 0 ? ports : [80, 443, 22, 3000, 8000]
      });
      if (result.error) throw new Error(result.error);

      setInstanceData(result);
      setCurrentStep(2);
      setLogs(prev => [...prev, `> Instance Created: ${result.instance_id}`, `> Public IP: ${result.public_ip}`]);
    } catch (err) {
      setError(err.message || 'Failed to create instance.');
      setLogs(prev => [...prev, `> Error: ${err.message}`]);
    } finally {
      setLoading(false);
    }
  };

  const handleClone = async (repo) => {
    if (!instanceData) return;
    setLoading(true);
    setCurrentStep(3);
    setLogs(prev => [...prev, `> Cloning Repository: ${repo.url}...`]);

    try {
      const result = await cloneRepos({
        ip_address: instanceData.public_ip,
        private_key: instanceData.private_key,
        repos: [{
          url: repo.url,
          branch: repo.branch,
          path: repo.path,
          git_token: repo.git_token || null
        }]
      });

      if (result.error) {
        const errorMsg = result.error;
        const details = result.details || '';
        setLogs(prev => [...prev, `> Error: ${errorMsg}`, `> Details: ${details}`]);
        throw new Error(errorMsg);
      }

      setLogs(prev => [...prev, ...result.logs]);
      setLogs(prev => [...prev, '> Repository Cloned Successfully!']);
    } catch (err) {
      setError(err.message || 'Clone failed.');
      if (!logs.some(l => l.includes(err.message))) {
        setLogs(prev => [...prev, `> Clone Exception: ${err.message}`]);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleStart = async (repo) => {
    if (!instanceData) return;
    setLoading(true);
    setLogs(prev => [...prev, `> Starting Application for ${repo.path || 'root'}...`]);

    const payload = {
      ip_address: instanceData.public_ip,
      private_key: instanceData.private_key,
      compose_path: repo.composePath || '.',
      frontend_path: repo.frontendPath || null,
      backend_path: repo.backendPath || null,
      env_vars: envVars.reduce((acc, curr) => {
        if (curr.key) acc[curr.key] = curr.value;
        return acc;
      }, {})
    };
    console.log("Sending Start Payload:", payload);

    try {
      const result = await startDeploy(payload);

      if (result.error) {
        const errorMsg = result.error;
        const details = result.details || '';
        setLogs(prev => [...prev, `> Error: ${errorMsg}`, `> Details: ${details}`]);
        throw new Error(errorMsg);
      }

      setLogs(prev => [...prev, ...result.logs]);
      setLogs(prev => [...prev, '> Application Started Successfully! Service is live.']);
      setCurrentStep(4);
    } catch (err) {
      setError(err.message || 'Start failed.');
      if (!logs.some(l => l.includes(err.message))) {
        setLogs(prev => [...prev, `> Start Exception: ${err.message}`]);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDestroy = async () => {
    setShowTerminateModal(true);
  };

  const confirmDestroy = async () => {
    setShowTerminateModal(false);
    if (!instanceData) return;

    setLoading(true);
    setLogs(prev => [...prev, '> Terminating Instance...']);

    try {
      const result = await deleteEC2({
        access_key: awsConfig.accessKey,
        secret_key: awsConfig.secretKey,
        region: awsConfig.region,
        instance_id: instanceData.instance_id
      });

      if (result.error) throw new Error(result.error);

      setLogs(prev => [...prev, '> Instance Terminated Successfully!']);
      setNotification({ type: 'success', message: 'Instance terminated successfully' });

      // Clear data and reset state completely
      setTimeout(() => {
        // Clear Local Storage
        localStorage.removeItem('awsConfig');
        localStorage.removeItem('repoList');
        localStorage.removeItem('instanceData');

        // Reset State
        setInstanceData(null);
        setAwsConfig({
          accessKey: '',
          secretKey: '',
          region: 'us-east-1',
          osType: 'ubuntu',
          instanceType: 't2.micro',
          allowedPorts: [80, 443, 22, 3000, 8000]
        });
        setRepoList([]);
        setLogs([]);
        setCurrentStep(0);
        setTerminationTime(null);
        setTerminalHistory([]);
        setTerminalInput('');
        setFileContent('');
        setFilePath('.env');
      }, 2000);
    } catch (err) {
      setError(err.message || 'Failed to terminate instance.');
      setLogs(prev => [...prev, `> Error: ${err.message}`]);
      setNotification({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleScheduleTermination = async () => {
    if (!instanceData) return;
    setLoading(true);
    setLogs(prev => [...prev, `> Scheduling termination in ${scheduleMinutes} minutes...`]);

    try {
      const result = await scheduleTermination({
        access_key: awsConfig.accessKey,
        secret_key: awsConfig.secretKey,
        region: awsConfig.region,
        instance_id: instanceData.instance_id,
        minutes: scheduleMinutes
      });

      if (result.error) {
        setError(result.error);
        setLogs(prev => [...prev, `✗ Error: ${result.error}`]);
      } else {
        setLogs(prev => [...prev, `✓ ${result.message}`]);
        const terminationTime = new Date(Date.now() + scheduleMinutes * 60000);
        setTerminationTime(terminationTime);
      }
    } catch (err) {
      setError(err.message);
      setLogs(prev => [...prev, `✗ Error: ${err.message}`]);
    } finally {
      setLoading(false);
    }
  };

  const handleGitPull = async () => {
    if (!instanceData) return;
    setLoading(true);
    setLogs(prev => [...prev, `> Pulling latest code and restarting containers...`]);

    try {
      const result = await gitPull({
        ip_address: instanceData.public_ip,
        private_key: instanceData.private_key,
        repos: repoList.map(({ url, branch, path, git_token }) => ({
          url,
          branch,
          path,
          git_token: git_token || null
        })),
        compose_path: '.',
        frontend_path: null,
        backend_path: null
      });

      if (result.error) {
        setError(result.error);
        setLogs(prev => [...prev, `✗ Error: ${result.error}`]);
      } else {
        setLogs(prev => [...prev, `✓ ${result.message}`]);
        if (result.logs) {
          result.logs.forEach(log => setLogs(prev => [...prev, log]));
        }
      }
    } catch (err) {
      setError(err.message);
      setLogs(prev => [...prev, `✗ Error: ${err.message}`]);
    } finally {
      setLoading(false);
    }
  };

  const handleRepoGitPull = async (repo) => {
    if (!instanceData) return;
    setLoading(true);
    setLogs(prev => [...prev, `> Pulling latest code for ${repo.path}...`]);

    try {
      const result = await gitPull({
        ip_address: instanceData.public_ip,
        private_key: instanceData.private_key,
        repos: [{
          url: repo.url,
          branch: repo.branch,
          path: repo.path,
          git_token: repo.git_token || null
        }],
        compose_path: repo.composePath || '.',
        frontend_path: repo.frontendPath || null,
        backend_path: repo.backendPath || null
      });

      if (result.error) {
        setError(result.error);
        setLogs(prev => [...prev, `✗ Error: ${result.error}`]);
        setNotification({ type: 'error', message: result.error });
      } else {
        setLogs(prev => [...prev, `✓ ${result.message}`]);
        setNotification({ type: 'success', message: `${repo.path} updated successfully` });
        if (result.logs) {
          result.logs.forEach(log => setLogs(prev => [...prev, log]));
        }
      }
    } catch (err) {
      setError(err.message);
      setLogs(prev => [...prev, `✗ Error: ${err.message}`]);
      setNotification({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleTerminalCommand = async (e) => {
    e.preventDefault();
    if (!terminalInput.trim() || !instanceData) return;

    const command = terminalInput.trim();
    setTerminalHistory(prev => [...prev, { type: 'input', content: `$ ${command}` }]);
    setTerminalInput('');

    // Also add to deployment logs
    setLogs(prev => [...prev, `$ ${command}`]);

    try {
      // Determine username based on OS type
      const username = instanceData.os_type === 'amazon_linux' ? 'ec2-user' : 'ubuntu';

      const result = await executeCommand({
        ip_address: instanceData.public_ip,
        private_key: instanceData.private_key,
        command: command,
        username: username
      });

      if (result.error) {
        setTerminalHistory(prev => [...prev, { type: 'error', content: result.error }]);
        setLogs(prev => [...prev, `✗ ${result.error}`]);
      } else {
        if (result.output) {
          setTerminalHistory(prev => [...prev, { type: 'output', content: result.output }]);
          // Add output to deployment logs as well
          setLogs(prev => [...prev, result.output]);
        }
        if (result.error && result.error.trim()) {
          setTerminalHistory(prev => [...prev, { type: 'error', content: result.error }]);
          setLogs(prev => [...prev, `✗ ${result.error}`]);
        }
      }
    } catch (err) {
      setTerminalHistory(prev => [...prev, { type: 'error', content: err.message }]);
      setLogs(prev => [...prev, `✗ ${err.message}`]);
    }
  };

  const handleReadFile = async () => {
    console.log("handleReadFile called");
    if (!instanceData) {
      console.error("No instance data");
      alert("No instance data found. Please create an instance first.");
      return;
    }
    if (!filePath.trim()) {
      alert("Please enter a file path.");
      return;
    }

    console.log("Reading file:", filePath);
    setFileLoading(true);

    try {
      const result = await readFile({
        ip_address: instanceData.public_ip,
        private_key: instanceData.private_key,
        file_path: filePath
      });

      console.log("Read result:", result);
      if (result.error) {
        setNotification({ type: 'error', message: result.error });
        setFileContent('');
      } else {
        setFileContent(result.content);
        setNotification({ type: 'success', message: 'File loaded successfully' });
      }
    } catch (err) {
      console.error("Read error:", err);
      setNotification({ type: 'error', message: err.message });
    } finally {
      setFileLoading(false);
    }
  };

  const handleWriteFile = async () => {
    console.log("handleWriteFile called");
    if (!instanceData || !filePath.trim()) return;
    setFileLoading(true);

    try {
      const result = await writeFile({
        ip_address: instanceData.public_ip,
        private_key: instanceData.private_key,
        file_path: filePath,
        content: fileContent
      });

      console.log("Write result:", result);
      if (result.error) {
        setNotification({ type: 'error', message: result.error });
      } else {
        setNotification({ type: 'success', message: result.message });
      }
    } catch (err) {
      console.error("Write error:", err);
      setNotification({ type: 'error', message: err.message });
    } finally {
      setFileLoading(false);
    }
  };


  const handleSchedule = async () => {
    if (!instanceData) return;
    if (window.confirm(`Schedule termination in ${scheduleMinutes} minutes?`)) {
      try {
        await scheduleTermination({
          access_key: awsConfig.accessKey,
          secret_key: awsConfig.secretKey,
          region: awsConfig.region,
          instance_id: instanceData.instance_id,
          minutes: scheduleMinutes
        });
        const now = new Date();
        const termTime = new Date(now.getTime() + scheduleMinutes * 60000);
        setTerminationTime(termTime);
        setLogs(prev => [...prev, `> Scheduled termination for ${termTime.toLocaleTimeString()}`]);
      } catch (err) {
        setError('Failed to schedule termination');
      }
    }
  };

  // Timer Effect
  useEffect(() => {
    if (!terminationTime) {
      setTimeLeft(null);
      return;
    }

    const interval = setInterval(() => {
      const now = new Date();
      const diff = terminationTime - now;

      if (diff <= 0) {
        setTimeLeft("Terminating...");
        clearInterval(interval);
        // Clear instance data and logs when scheduled termination completes
        setTimeout(() => {
          setInstanceData(null);
          setLogs([]);
          setCurrentStep(0);
          setTerminationTime(null);
        }, 2000); // Wait 2 seconds to show "Terminating..." message
      } else {
        const minutes = Math.floor(diff / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);
        setTimeLeft(`${minutes}m ${seconds}s`);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [terminationTime]);

  // Persistence Effect
  useEffect(() => {
    localStorage.setItem('awsConfig', JSON.stringify(awsConfig));
    localStorage.setItem('repoList', JSON.stringify(repoList));
    localStorage.setItem('currentStep', currentStep.toString());
  }, [awsConfig, repoList, envVars, instanceData, logs, currentStep]);

  return (
    <div className="app-container">

      {/* Header */}
      <div className="header-card">
        <div className="relative z-10">
          <h1 className="header-title">
            <Cloud className="text-blue-500" /> Cloud Orchestrator
          </h1>
          <p className="text-secondary text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>AWS EC2 Provisioning & Deployment Automation</p>
        </div>
        <div className="flex items-center gap-4 relative z-10">
          <div className={`status-badge ${instanceData ? 'status-online' : 'status-idle'}`}>
            <Activity size={14} />
            {instanceData ? 'SYSTEM ONLINE' : 'SYSTEM IDLE'}
          </div>
        </div>
        {/* Decorative background element */}
        <div style={{ position: 'absolute', top: 0, right: 0, width: '16rem', height: '16rem', background: 'rgba(59, 130, 246, 0.05)', borderRadius: '9999px', filter: 'blur(40px)', transform: 'translate(50%, -50%)' }}></div>
      </div>

      {/* Left Column: Configuration */}
      <div className="flex-col">

        {/* AWS Config Form */}
        <div className="card">
          <h2 className="card-title">
            <Shield size={18} className="text-warning" style={{ color: '#f59e0b' }} /> AWS Credentials
          </h2>
          <form onSubmit={handleCreateServer}>
            <div className="form-group">
              <label className="form-label">Access Key ID</label>
              <input
                type="text"
                value={awsConfig.accessKey}
                onChange={e => setAwsConfig({ ...awsConfig, accessKey: e.target.value })}
                className="form-input"
                placeholder="AKIA..."
                disabled={currentStep > 0}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Secret Access Key</label>
              <input
                type="password"
                value={awsConfig.secretKey}
                onChange={e => setAwsConfig({ ...awsConfig, secretKey: e.target.value })}
                className="form-input"
                placeholder="Secret Key"
                required
              />
            </div>
            <div className="grid-2">
              <div>
                <label className="form-label">Region</label>
                <input
                  type="text"
                  className="form-input"
                  value={awsConfig.region}
                  onChange={e => setAwsConfig({ ...awsConfig, region: e.target.value })}
                />
              </div>
              <div>
                <label className="form-label">OS Type</label>
                <select
                  className="form-select"
                  value={awsConfig.osType}
                  onChange={e => setAwsConfig({ ...awsConfig, osType: e.target.value })}
                >
                  <option value="ubuntu">Ubuntu 22.04</option>
                  <option value="amazon_linux">Amazon Linux 2</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Instance Type</label>
              <select
                className="form-select"
                value={awsConfig.instanceType}
                onChange={e => setAwsConfig({ ...awsConfig, instanceType: e.target.value })}
              >
                <option value="t2.micro">t2.micro (1 vCPU, 1 GB RAM) - Free Tier</option>
                <option value="t2.small">t2.small (1 vCPU, 2 GB RAM)</option>
                <option value="t2.medium">t2.medium (2 vCPU, 4 GB RAM)</option>
                <option value="t3.micro">t3.micro (2 vCPU, 1 GB RAM)</option>
                <option value="t3.small">t3.small (2 vCPU, 2 GB RAM)</option>
                <option value="t3.medium">t3.medium (2 vCPU, 4 GB RAM)</option>
              </select>
            </div>
            <div className="form-group" style={{ marginTop: '1rem' }}>
              <label className="form-label">Allowed Ports (comma separated)</label>
              <input
                type="text"
                className="form-input"
                value={awsConfig.allowedPorts}
                onChange={e => setAwsConfig({ ...awsConfig, allowedPorts: e.target.value })}
                placeholder="80, 443, 22, 3000, 8000"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !awsConfig.accessKey}
              className="btn btn-primary"
              style={{ marginTop: '1rem' }}
            >
              {loading ? 'Provisioning...' : <><Server size={16} /> {currentStep > 0 ? 'Update / Re-create Instance' : 'Create EC2 Instance'}</>}
            </button>
          </form>
        </div>

        {/* Repo Config Form */}
        <div className="card" style={{ opacity: currentStep < 2 ? 0.5 : 1, pointerEvents: currentStep < 2 ? 'none' : 'auto' }}>
          <h2 className="card-title">
            <Github size={18} className="text-accent-purple" style={{ color: '#a855f7' }} /> App Repositories
          </h2>
          <div>




            <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
              <span>Repositories</span>
              <button
                type="button"
                onClick={() => setRepoList([...repoList, { url: '', branch: 'main', path: '.', id: Date.now() }])}
                style={{ background: 'none', border: 'none', color: '#4ade80', cursor: 'pointer', fontSize: '1.25rem', padding: 0 }}
              >
                +
              </button>
            </label>

            {repoList.map((repo, index) => (
              <div key={repo.id} style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.03)', borderRadius: '0.5rem', marginBottom: '0.75rem', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Repo #{index + 1}</span>
                  {repoList.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setRepoList(repoList.filter(r => r.id !== repo.id))}
                      style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '0.75rem' }}
                    >
                      Remove
                    </button>
                  )}
                </div>
                <div className="form-group">
                  <input
                    type="text"
                    value={repo.url}
                    onChange={e => {
                      const newList = [...repoList];
                      newList[index].url = e.target.value;
                      setRepoList(newList);
                    }}
                    className="form-input"
                    placeholder="Git URL"
                  />
                </div>
                <div className="grid-2">
                  <div className="form-group">
                    <input
                      type="text"
                      value={repo.branch}
                      onChange={e => {
                        const newList = [...repoList];
                        newList[index].branch = e.target.value;
                        setRepoList(newList);
                      }}
                      className="form-input"
                      placeholder="Branch"
                    />
                  </div>
                  <div className="form-group">
                    <input
                      type="text"
                      value={repo.path}
                      onChange={e => {
                        const newList = [...repoList];
                        newList[index].path = e.target.value;
                        setRepoList(newList);
                      }}
                      className="form-input"
                      placeholder="Clone Path (e.g. backend)"
                    />
                  </div>
                </div>
                <div className="form-group">
                  <input
                    type="password"
                    value={repo.git_token || ''}
                    onChange={e => {
                      const newList = [...repoList];
                      newList[index].git_token = e.target.value;
                      setRepoList(newList);
                    }}
                    className="form-input"
                    placeholder="Git Token (optional, for private repos)"
                    style={{ fontSize: '0.875rem' }}
                    autoComplete="new-password"
                  />
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.25rem', display: 'block' }}>
                    For private repos: GitHub PAT, GitLab token, etc.
                  </span>
                </div>

                {/* Per-Repo Docker Config */}
                <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: 'rgba(0,0,0,0.2)', borderRadius: '0.5rem' }}>
                  <label className="form-label" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Docker Configuration</label>
                  <div className="form-group">
                    <input
                      type="text"
                      value={repo.composePath}
                      onChange={e => {
                        const newList = [...repoList];
                        newList[index].composePath = e.target.value;
                        setRepoList(newList);
                      }}
                      className="form-input"
                      placeholder="Docker Compose Directory (default: .)"
                      style={{ fontSize: '0.875rem' }}
                    />
                  </div>
                  <div className="grid-2" style={{ marginTop: '0.5rem' }}>
                    <div className="form-group">
                      <input
                        type="text"
                        value={repo.frontendPath}
                        onChange={e => {
                          const newList = [...repoList];
                          newList[index].frontendPath = e.target.value;
                          setRepoList(newList);
                        }}
                        className="form-input"
                        placeholder="Frontend Path (optional)"
                        style={{ fontSize: '0.875rem' }}
                      />
                    </div>
                    <div className="form-group">
                      <input
                        type="text"
                        value={repo.backendPath}
                        onChange={e => {
                          const newList = [...repoList];
                          newList[index].backendPath = e.target.value;
                          setRepoList(newList);
                        }}
                        className="form-input"
                        placeholder="Backend Path (optional)"
                        style={{ fontSize: '0.875rem' }}
                      />
                    </div>
                  </div>
                </div>

                {/* Per-Repo Actions */}
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                  <button
                    type="button"
                    onClick={() => handleClone(repo)}
                    disabled={loading || !instanceData}
                    className="btn btn-blue"
                    style={{ flex: 1, fontSize: '0.8rem', padding: '0.4rem' }}
                  >
                    <Github size={14} style={{ marginRight: '0.25rem' }} /> Clone
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStart(repo)}
                    disabled={loading || !instanceData}
                    className="btn btn-green"
                    style={{ flex: 1, fontSize: '0.8rem', padding: '0.4rem' }}
                  >
                    <Play size={14} style={{ marginRight: '0.25rem' }} /> Deploy
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRepoGitPull(repo)}
                    disabled={loading || !instanceData}
                    className="btn"
                    style={{ flex: 1, fontSize: '0.8rem', padding: '0.4rem', background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)', border: '1px solid rgba(139, 92, 246, 0.3)' }}
                  >
                    <RefreshCw size={14} style={{ marginRight: '0.25rem' }} /> Pull & Restart
                  </button>
                </div>
              </div>
            ))}

            {/* Environment Variables */}
            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Environment Variables</span>
                <button
                  type="button"
                  onClick={() => setEnvVars([...envVars, { key: '', value: '' }])}
                  style={{ background: 'none', border: 'none', color: '#4ade80', cursor: 'pointer', fontSize: '1.25rem', padding: 0 }}
                >
                  +
                </button>
              </label>
              {envVars.map((env, index) => (
                <div key={index} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <input
                    type="text"
                    placeholder="KEY"
                    value={env.key}
                    onChange={e => {
                      const newVars = [...envVars];
                      newVars[index].key = e.target.value;
                      setEnvVars(newVars);
                    }}
                    className="form-input"
                    style={{ flex: 1 }}
                  />
                  <input
                    type="text"
                    placeholder="VALUE"
                    value={env.value}
                    onChange={e => {
                      const newVars = [...envVars];
                      newVars[index].value = e.target.value;
                      setEnvVars(newVars);
                    }}
                    className="form-input"
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const newVars = envVars.filter((_, i) => i !== index);
                      setEnvVars(newVars);
                    }}
                    style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#f87171', borderRadius: '0.25rem', padding: '0 0.5rem', cursor: 'pointer' }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>


          </div>
        </div>
      </div>

      {/* Right Column: Status & Terminal */}
      <div className="flex-col">

        {/* Status Display */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ background: 'rgba(30, 41, 59, 0.5)', padding: '1rem 1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontWeight: 600, color: 'white', margin: 0 }}>Instance Status</h3>
            {instanceData && <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              {!timeLeft && (
                <input
                  type="number"
                  min="1"
                  value={scheduleMinutes}
                  onChange={(e) => setScheduleMinutes(Number(e.target.value))}
                  className="form-input"
                  style={{ width: '60px', padding: '0.25rem', height: 'auto', fontSize: '0.875rem' }}
                  title="Minutes to auto-termination"
                />
              )}
              <button
                onClick={handleSchedule}
                className="btn"
                style={{ background: 'transparent', border: '1px solid var(--warning)', color: 'var(--warning)', padding: '0.25rem 0.5rem', fontSize: '0.75rem', width: 'auto' }}
              >
                {timeLeft ? timeLeft : 'Schedule Stop'}
              </button>
              <button
                onClick={handleDestroy}
                className="btn"
                style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#f87171', padding: '0.25rem 0.5rem', fontSize: '0.75rem', width: 'auto' }}
              >
                <Trash2 size={12} /> Terminate
              </button>
            </div>
            }
          </div>
          <div style={{ padding: '1.5rem' }}>
            {!instanceData ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2.5rem 0', color: 'var(--text-secondary)' }}>
                <Server size={48} style={{ marginBottom: '1rem', opacity: 0.2 }} />
                <p>No active instances. Configure AWS keys to begin.</p>
              </div>
            ) : (
              <div className="grid-2">
                <div style={{ padding: '1rem', background: 'var(--bg-dark)', borderRadius: '0.25rem', border: '1px solid var(--border-color)' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Public IPv4</span>
                  <span className="text-mono text-blue" style={{ fontSize: '1.125rem' }}>{instanceData.public_ip}</span>
                </div>
                <div style={{ padding: '1rem', background: 'var(--bg-dark)', borderRadius: '0.25rem', border: '1px solid var(--border-color)' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Instance ID</span>
                  <span className="text-mono text-white" style={{ fontSize: '1.125rem' }}>{instanceData.instance_id}</span>
                </div>
                <div style={{ padding: '1rem', background: 'var(--bg-dark)', borderRadius: '0.25rem', border: '1px solid var(--border-color)', gridColumn: '1 / -1' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Public URL</span>
                  {currentStep === 4 ? (
                    <a href={`http://${instanceData.public_ip}`} target="_blank" rel="noreferrer" style={{ color: '#4ade80', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      http://{instanceData.public_ip} <Play size={12} />
                    </a>
                  ) : (
                    <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>Application not deployed yet</span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Terminal / Logs */}
        <div className="terminal" style={{ maxHeight: '500px', display: 'flex', flexDirection: 'column' }}>
          <div className="terminal-header" style={{ justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <TerminalIcon size={14} style={{ color: 'var(--text-secondary)' }} />
              <span className="text-mono" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Deployment Logs</span>
            </div>
            <button
              onClick={() => {
                setLogs([]);
                setError(null);
              }}
              className="btn"
              style={{
                padding: '0.1rem 0.5rem',
                fontSize: '0.7rem',
                width: 'auto',
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.2)',
                color: 'var(--text-secondary)'
              }}
            >
              Clear Logs
            </button>
          </div>

          {/* Log Content Area */}
          <div className="terminal-content" style={{ overflowY: 'auto', flex: 1 }}>
            {logs.length === 0 && <span style={{ color: 'var(--text-secondary)', opacity: 0.5 }}>Waiting for logs...</span>}
            {logs.map((log, i) => (
              <div key={i} style={{ marginBottom: '0.25rem' }}>{log}</div>
            ))}
            {error && <div style={{ color: 'var(--error)', marginTop: '0.5rem' }}>Error: {error}</div>}
          </div>
        </div>

        {/* Interactive Terminal */}
        {instanceData && (
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 className="card-title">
                <TerminalIcon size={18} className="text-accent-green" style={{ color: '#4ade80' }} /> Interactive Terminal
              </h2>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={() => setFullScreenTerminal(true)}
                  disabled={!terminalOpen}
                  className="btn"
                  style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', width: 'auto' }}
                >
                  Full Screen
                </button>
                <button
                  onClick={() => {
                    setTerminalOpen(!terminalOpen);
                    if (!terminalOpen) setTerminalHistory([]);
                  }}
                  className="btn"
                  style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', width: 'auto' }}
                >
                  {terminalOpen ? 'Close' : 'Open'}
                </button>
              </div>
            </div>

            {terminalOpen && !fullScreenTerminal && (
              <div>
                <div style={{
                  background: '#0a0a0a',
                  borderRadius: '0.5rem',
                  padding: '1rem',
                  fontFamily: 'monospace',
                  fontSize: '0.875rem',
                  maxHeight: '600px',
                  overflowY: 'auto',
                  marginBottom: '0.75rem',
                  border: '1px solid rgba(255,255,255,0.1)'
                }}>
                  {terminalHistory.length === 0 ? (
                    <div style={{ color: '#666', fontStyle: 'italic' }}>
                      Terminal ready. Type commands to execute on your EC2 instance.
                    </div>
                  ) : (
                    terminalHistory.map((item, index) => (
                      <div key={index} style={{
                        marginBottom: '0.5rem',
                        color: item.type === 'input' ? '#4ade80' : item.type === 'error' ? '#f87171' : '#e5e7eb',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-all'
                      }}>
                        {item.content}
                      </div>
                    ))
                  )}
                </div>

                <form onSubmit={handleTerminalCommand} style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="text"
                    value={terminalInput}
                    onChange={e => setTerminalInput(e.target.value)}
                    placeholder="Enter command (e.g., ls -la, pwd, docker ps)"
                    className="form-input"
                    style={{ flex: 1, fontFamily: 'monospace' }}
                  />
                  <button
                    type="submit"
                    disabled={loading}
                    className="btn btn-green"
                    style={{ width: 'auto', padding: '0.5rem 1rem' }}
                  >
                    Execute
                  </button>
                </form>
              </div>
            )}
          </div>
        )}

        {/* Full Screen Terminal Modal */}
        {fullScreenTerminal && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: '#0a0a0a',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            padding: '1rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ color: '#4ade80', fontSize: '1.25rem', margin: 0 }}>
                <TerminalIcon size={20} style={{ display: 'inline', marginRight: '0.5rem' }} />
                Interactive Terminal - Full Screen
              </h2>
              <button
                onClick={() => setFullScreenTerminal(false)}
                className="btn"
                style={{ background: '#ef4444', border: 'none' }}
              >
                Exit Full Screen
              </button>
            </div>

            <div style={{
              flex: 1,
              background: '#000',
              borderRadius: '0.5rem',
              padding: '1rem',
              fontFamily: 'monospace',
              fontSize: '0.95rem',
              overflowY: 'auto',
              marginBottom: '1rem',
              border: '1px solid rgba(255,255,255,0.2)'
            }}>
              {terminalHistory.map((item, i) => (
                <div key={i} style={{
                  color: item.type === 'input' ? '#4ade80' : item.type === 'error' ? '#ef4444' : '#e5e7eb',
                  marginBottom: '0.5rem',
                  whiteSpace: 'pre-wrap'
                }}>
                  {item.content}
                </div>
              ))}
            </div>

            <form onSubmit={handleTerminalCommand} style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="text"
                value={terminalInput}
                onChange={e => setTerminalInput(e.target.value)}
                placeholder="Enter command..."
                className="form-input"
                style={{ flex: 1, fontFamily: 'monospace', fontSize: '1rem' }}
                autoFocus
              />
              <button
                type="submit"
                disabled={loading}
                className="btn btn-green"
                style={{ width: 'auto', padding: '0.75rem 1.5rem' }}
              >
                Execute
              </button>
            </form>
          </div>
        )}

        {/* File Editor */}
        {instanceData && (
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 className="card-title">
                <FileEdit size={18} className="text-accent-blue" style={{ color: '#3b82f6' }} /> File Editor
              </h2>
              <button
                onClick={() => setFileEditorOpen(!fileEditorOpen)}
                className="btn"
                style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', width: 'auto' }}
              >
                {fileEditorOpen ? 'Close' : 'Open'}
              </button>
            </div>

            {fileEditorOpen && (
              <div>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <input
                    type="text"
                    value={filePath}
                    onChange={e => setFilePath(e.target.value)}
                    placeholder="File path (e.g., .env, repo-name/.env)"
                    className="form-input"
                    style={{ flex: 1, fontFamily: 'monospace' }}
                  />
                  <button
                    type="button"
                    onClick={handleReadFile}
                    disabled={fileLoading}
                    className="btn"
                    style={{ width: 'auto', padding: '0.5rem 1rem', background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', border: '1px solid rgba(59, 130, 246, 0.3)' }}
                  >
                    Load
                  </button>
                </div>

                <textarea
                  value={fileContent}
                  onChange={e => setFileContent(e.target.value)}
                  placeholder="File content will appear here..."
                  style={{
                    width: '100%',
                    minHeight: '200px',
                    background: '#0a0a0a',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '0.5rem',
                    padding: '1rem',
                    fontFamily: 'monospace',
                    fontSize: '0.875rem',
                    color: '#e5e7eb',
                    resize: 'vertical'
                  }}
                />

                <button
                  type="button"
                  onClick={handleWriteFile}
                  disabled={fileLoading || !filePath.trim()}
                  className="btn btn-green"
                  style={{ marginTop: '0.75rem', width: 'auto', padding: '0.5rem 1rem' }}
                >
                  {fileLoading ? 'Saving...' : 'Save File'}
                </button>
              </div>
            )}
          </div>
        )}

      </div>
      {/* Notification Toast */}
      {
        notification && (
          <div style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            padding: '1rem 1.5rem',
            borderRadius: '0.5rem',
            background: notification.type === 'success' ? '#22c55e' : '#ef4444',
            color: 'white',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
            zIndex: 1000,
            animation: 'slideIn 0.3s ease-out'
          }}>
            {notification.message}
          </div>
        )
      }

      {/* Terminate Confirmation Modal */}
      {
        showTerminateModal && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}>
            <div className="card" style={{ width: '400px', maxWidth: '90%' }}>
              <h3 className="text-xl font-bold mb-4 text-white">Confirm Termination</h3>
              <p className="text-secondary mb-6">
                Are you sure you want to terminate this instance? This action cannot be undone and all data will be lost.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowTerminateModal(false)}
                  className="btn"
                  style={{ background: 'transparent', border: '1px solid var(--border-color)' }}
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDestroy}
                  className="btn"
                  style={{ background: '#ef4444', border: 'none' }}
                >
                  Terminate
                </button>
              </div>
            </div>
          </div>
        )
      }
    </div >
  );
}
