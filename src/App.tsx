import React, { useEffect, useRef, useState } from 'react';
import {
  Layout,
  Table,
  Spin,
  message,
  Typography,
  Button,
  Modal,
  Form,
  Input,
  Space,
  Popconfirm,
  Tag,
  Card,
  Empty,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { FormInstance } from 'antd';

const { Header, Content } = Layout;
const { Title } = Typography;

// --- Interfaces ---
interface TaskExecution {
  startTime: string;
  endTime: string;
  output: string;
}

interface Task {
  id: string;
  name: string;
  owner: string;
  command: string;
  taskExecutions: TaskExecution[];
}

// --- Constants ---
const API_URL = 'http://localhost:8080';

// --- Main App Component ---
const App: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isModalVisible, setIsModalVisible] = useState<boolean>(false);
  const [form] = Form.useForm();
  const [expandedRowKeys, setExpandedRowKeys] = useState<readonly React.Key[]>([]);
  const [searchText, setSearchText] = useState<string>('');
  const [outputModalVisible, setOutputModalVisible] = useState<boolean>(false);
  const [selectedOutput, setSelectedOutput] = useState<string>('');
  const outputPreRef = useRef<HTMLPreElement | null>(null);

  // --- API Calls ---
  const fetchTasks = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/tasks`);
      if (!response.ok) throw new Error('Network response was not ok');
      const data: Task[] = await response.json();
      setTasks(data);
    } catch (error) {
      message.error('Failed to fetch tasks. Make sure your backend is running!');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const handleCreate = async (values: Omit<Task, 'id' | 'taskExecutions'>) => {
    try {
      const response = await fetch(`${API_URL}/tasks`, {
        // ✅ CORRECTED: Changed method from 'PUT' to 'POST'
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        // Provide more specific error for bad requests (e.g., invalid command)
        if (response.status === 400) {
            throw new Error('Failed to create task. The command may be invalid or contain forbidden words like "rm" or "sudo".');
        }
        throw new Error('Failed to create the task.');
      }

      message.success('Task created successfully!');
      setIsModalVisible(false);
      form.resetFields();
      await fetchTasks();
    } catch (error) {
        if (error instanceof Error) {
            message.error(error.message);
        } else {
            message.error('An unknown error occurred while creating the task.');
        }
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`${API_URL}/tasks/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete the task.');
      message.success('Task deleted successfully!');
      await fetchTasks();
    } catch (error) {
      message.error('Error deleting task.');
    }
  };

  const handleRun = async (id: string) => {
    try {
      const response = await fetch(`${API_URL}/tasks/${id}/execute`, { method: 'PUT' });
      if (!response.ok) throw new Error('Failed to run the task.');
      message.success(`Task execution started! Refreshing data...`);
      await fetchTasks();
      // Automatically expand the row to show the new execution log
      setExpandedRowKeys([id]);
    } catch (error) {
      message.error('Error running task.');
    }
  };
  
  // --- Table Columns ---
  const columns: ColumnsType<Task> = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 220, ellipsis: true },
    { title: 'Name', dataIndex: 'name', key: 'name', render: text => <strong>{text}</strong> },
    { title: 'Owner', dataIndex: 'owner', key: 'owner' },
    { title: 'Command', dataIndex: 'command', key: 'command', render: cmd => <Tag color="blue">{cmd}</Tag> },
    {
      title: 'Actions',
      key: 'actions',
      width: 200,
      render: (_, record) => (
        <Space size="middle">
          <Button type="primary" onClick={() => handleRun(record.id)}>Run</Button>
          <Popconfirm
            title="Delete the task"
            description="Are you sure you want to delete this task?"
            onConfirm={() => handleDelete(record.id)}
            okText="Yes"
            cancelText="No"
          >
            <Button danger>Delete</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const expandedRowRender = (record: Task) => {
    const nestedColumns: ColumnsType<TaskExecution> = [
      { title: 'Start Time', dataIndex: 'startTime', key: 'startTime', render: val => <Tag color="cyan">{new Date(val).toLocaleString()}</Tag> },
      { title: 'End Time', dataIndex: 'endTime', key: 'endTime', render: val => <Tag color="geekblue">{new Date(val).toLocaleString()}</Tag> },
      {
        title: 'Output',
        dataIndex: 'output',
        key: 'output',
        render: out => (
            <Button type="link" onClick={() => { setSelectedOutput(out || ''); setOutputModalVisible(true); }}>
              View Output
            </Button>
        ),
      },
    ];

    return (
      <Card title="Execution History" size="small" style={{ margin: '16px 0' }}>
        <Table
          columns={nestedColumns}
          dataSource={record.taskExecutions}
          pagination={false}
          rowKey="startTime"
          size="small"
        />
      </Card>
    );
  };
  
  // --- Filtering ---
  const filteredTasks = tasks.filter(task =>
    task.name.toLowerCase().includes(searchText.toLowerCase()) ||
    (task.owner && task.owner.toLowerCase().includes(searchText.toLowerCase())) ||
    task.command.toLowerCase().includes(searchText.toLowerCase())
  );

  // --- Render ---
  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ display: 'flex', alignItems: 'center', padding: '0 50px' }}>
        <Title level={2} style={{ color: 'white', margin: 0 }}>Task Management Dashboard</Title>
      </Header>

      <Content style={{ padding: '50px' }}>
        <div style={{ background: '#fff', padding: 24, borderRadius: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
            <Button type="primary" onClick={() => setIsModalVisible(true)}>Create New Task</Button>
            <Input.Search
              placeholder="Search tasks..."
              allowClear
              onChange={e => setSearchText(e.target.value)}
              style={{ width: 400 }}
            />
          </div>

          <Spin spinning={loading} tip="Loading tasks...">
            <Table
              columns={columns}
              dataSource={filteredTasks}
              rowKey="id"
              pagination={{ pageSize: 10 }}
              bordered
              expandable={{
                expandedRowRender,
                rowExpandable: record => record.taskExecutions && record.taskExecutions.length > 0,
                expandedRowKeys: expandedRowKeys,
                onExpand: (expanded, record) => setExpandedRowKeys(expanded ? [record.id] : []),
              }}
               locale={{ emptyText: <Empty description={searchText ? "No tasks match your search." : "No tasks found. Create one!"} /> }}
            />
          </Spin>
        </div>
      </Content>

      <Modal title="Create a New Task" open={isModalVisible} onCancel={() => setIsModalVisible(false)} footer={null} destroyOnClose>
        <CreateTaskForm form={form} onFinish={handleCreate} />
      </Modal>

      <Modal title="Command Output" open={outputModalVisible} onCancel={() => setOutputModalVisible(false)} footer={null} width={800}>
        <pre ref={outputPreRef} style={{ background: '#f5f5f5', padding: '16px', borderRadius: '4px', maxHeight: '60vh', overflowY: 'auto' }}>
          {selectedOutput || 'No output available.'}
        </pre>
      </Modal>
    </Layout>
  );
};

// --- Sub-component: Create Task Form ---
const CreateTaskForm = ({ form, onFinish }: { form: FormInstance; onFinish: (values: any) => void }) => {
  return (
    <Form form={form} onFinish={onFinish} layout="vertical" style={{marginTop: 24}}>
      <Form.Item name="name" label="Task Name" rules={[{ required: true, message: 'Please input the task name!' }]}>
        <Input placeholder="e.g., Daily Backup Script" />
      </Form.Item>
      <Form.Item name="owner" label="Owner" rules={[{ required: true, message: 'Please input the owner!' }]}>
        <Input placeholder="e.g., admin" />
      </Form.Item>
      <Form.Item name="command" label="Shell Command" rules={[{ required: true, message: 'Please input the command!' }]}>
        <Input.TextArea rows={4} placeholder="e.g., ls -la /var/log" />
      </Form.Item>
      <Form.Item>
        <Button type="primary" htmlType="submit" block>Submit Task</Button>
      </Form.Item>
    </Form>
  );
};

export default App;