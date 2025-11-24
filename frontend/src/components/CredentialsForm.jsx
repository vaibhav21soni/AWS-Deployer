import React, { useState } from 'react';

const CredentialsForm = ({ onSubmit, isLoading }) => {
    const [accessKey, setAccessKey] = useState('');
    const [secretKey, setSecretKey] = useState('');
    const [region, setRegion] = useState('us-east-1');
    const [osType, setOsType] = useState('ubuntu');

    const handleSubmit = (e) => {
        e.preventDefault();
        onSubmit({ access_key: accessKey, secret_key: secretKey, region, os_type: osType });
    };

    return (
        <div className="glass-panel">
            <h2 className="text-2xl font-bold mb-6" style={{ color: 'var(--text-primary)' }}>AWS Credentials</h2>
            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label>Access Key ID</label>
                    <input
                        type="text"
                        value={accessKey}
                        onChange={(e) => setAccessKey(e.target.value)}
                        required
                        placeholder="AKIA..."
                    />
                </div>
                <div className="form-group">
                    <label>Secret Access Key</label>
                    <input
                        type="password"
                        value={secretKey}
                        onChange={(e) => setSecretKey(e.target.value)}
                        required
                        placeholder="wJalr..."
                    />
                </div>
                <div className="grid-2">
                    <div className="form-group">
                        <label>Region</label>
                        <input
                            type="text"
                            value={region}
                            onChange={(e) => setRegion(e.target.value)}
                            placeholder="us-east-1"
                        />
                    </div>
                    <div className="form-group">
                        <label>Operating System</label>
                        <select
                            value={osType}
                            onChange={(e) => setOsType(e.target.value)}
                            style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)' }}
                        >
                            <option value="ubuntu">Ubuntu 22.04 LTS</option>
                            <option value="amazon_linux">Amazon Linux 2023</option>
                        </select>
                    </div>
                </div>
                <button
                    type="submit"
                    disabled={isLoading}
                    className="btn btn-primary"
                >
                    {isLoading ? 'Provisioning Instance...' : 'Create EC2 Instance'}
                </button>
            </form>
        </div>
    );
};

export default CredentialsForm;
