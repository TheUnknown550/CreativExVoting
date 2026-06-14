import { DeleteOutlined, EditOutlined, KeyOutlined, PlusOutlined } from '@ant-design/icons';
import {
  Button,
  Card,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Typography,
  message,
} from 'antd';
import { useEffect, useState } from 'react';

import * as adminApi from '../../api/admin';
import { ApiError } from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import type { Category, JudgePayload, User } from '../../types/domain';

const blankJudge: JudgePayload = {
  username: '',
  display_name: '',
  password: '',
  role: 'judge',
  is_active: true,
  category_ids: [],
};

export function AdminJudgesPage() {
  const { token } = useAuth();
  const [form] = Form.useForm<JudgePayload>();
  const [passwordForm] = Form.useForm<{ password: string }>();
  const [categories, setCategories] = useState<Category[]>([]);
  const [judges, setJudges] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [editingJudge, setEditingJudge] = useState<User | null>(null);
  const [saving, setSaving] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();

  async function loadPageData() {
    if (!token) {
      return;
    }
    setLoading(true);
    try {
      const [nextJudges, nextCategories] = await Promise.all([
        adminApi.getAdminJudges(token),
        adminApi.getAdminCategories(token),
      ]);
      setJudges(nextJudges);
      setCategories(nextCategories);
    } catch (error) {
      messageApi.error(error instanceof ApiError ? error.message : 'Unable to load judges.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPageData();
  }, [token]);

  function openCreateModal() {
    setEditingJudge(null);
    form.setFieldsValue(blankJudge);
    setModalOpen(true);
  }

  async function openEditModal(judge: User) {
    if (!token) {
      return;
    }

    setEditingJudge(judge);
    try {
      const categoryIds = await adminApi.getJudgeAssignments(token, judge.id);
      form.setFieldsValue({
        username: judge.username,
        display_name: judge.display_name,
        role: judge.role,
        is_active: judge.is_active,
        category_ids: categoryIds,
      });
      setModalOpen(true);
    } catch (error) {
      messageApi.error(error instanceof ApiError ? error.message : 'Unable to load assignments.');
    }
  }

  async function handleSubmit(values: JudgePayload) {
    if (!token) {
      return;
    }

    setSaving(true);
    try {
      if (editingJudge) {
        await adminApi.updateJudge(token, editingJudge.id, {
          ...values,
          password: undefined,
        });
      } else {
        await adminApi.createJudge(token, values);
      }
      setModalOpen(false);
      await loadPageData();
      messageApi.success(`Judge ${editingJudge ? 'updated' : 'created'} successfully.`);
    } catch (error) {
      messageApi.error(error instanceof ApiError ? error.message : 'Unable to save judge.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!token) {
      return;
    }
    try {
      await adminApi.deleteJudge(token, id);
      await loadPageData();
      messageApi.success('Judge deactivated.');
    } catch (error) {
      messageApi.error(error instanceof ApiError ? error.message : 'Unable to deactivate judge.');
    }
  }

  async function handleResetPassword(values: { password: string }) {
    if (!token || !editingJudge) {
      return;
    }
    setSaving(true);
    try {
      await adminApi.resetJudgePassword(token, editingJudge.id, values.password);
      setPasswordModalOpen(false);
      passwordForm.resetFields();
      messageApi.success('Password reset successfully.');
    } catch (error) {
      messageApi.error(error instanceof ApiError ? error.message : 'Unable to reset password.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {contextHolder}
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <section className="page-hero">
          <Typography.Title className="page-title" level={1}>
            Judge Management
          </Typography.Title>
          <Typography.Paragraph className="page-subtitle">
            Provision judge accounts, control access, reset credentials, and assign each judge to the
            categories they should review.
          </Typography.Paragraph>
        </section>

        <Card className="soft-card">
          <div className="table-toolbar">
            <Typography.Title level={4} style={{ margin: 0 }}>
              Judges &amp; Admins
            </Typography.Title>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
              New User
            </Button>
          </div>

          <Table<User>
            rowKey="id"
            loading={loading}
            dataSource={judges}
            pagination={false}
            columns={[
              { title: 'Display Name', dataIndex: 'display_name' },
              { title: 'Username', dataIndex: 'username' },
              { title: 'Role', dataIndex: 'role', width: 120 },
              {
                title: 'Status',
                dataIndex: 'is_active',
                width: 120,
                render: (value: boolean) =>
                  value ? <Typography.Text style={{ color: '#4f7a57' }}>Active</Typography.Text> : 'Inactive',
              },
              {
                title: 'Actions',
                width: 260,
                render: (_, record) => (
                  <Space>
                    <Button icon={<EditOutlined />} onClick={() => void openEditModal(record)}>
                      Edit
                    </Button>
                    <Button
                      icon={<KeyOutlined />}
                      onClick={() => {
                        setEditingJudge(record);
                        setPasswordModalOpen(true);
                      }}
                    >
                      Reset Password
                    </Button>
                    <Popconfirm title="Deactivate this user?" onConfirm={() => void handleDelete(record.id)}>
                      <Button danger icon={<DeleteOutlined />}>
                        Deactivate
                      </Button>
                    </Popconfirm>
                  </Space>
                ),
              },
            ]}
          />
        </Card>
      </Space>

      <Modal
        open={modalOpen}
        title={editingJudge ? 'Edit User' : 'Create User'}
        onCancel={() => setModalOpen(false)}
        onOk={() => void form.submit()}
        confirmLoading={saving}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit} initialValues={blankJudge}>
          <Form.Item name="username" label="Username" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="display_name" label="Display Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          {!editingJudge ? (
            <Form.Item name="password" label="Password" rules={[{ required: true }]}>
              <Input.Password />
            </Form.Item>
          ) : null}
          <Form.Item name="role" label="Role" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'judge', label: 'Judge' },
                { value: 'admin', label: 'Admin' },
              ]}
            />
          </Form.Item>
          <Form.Item name="category_ids" label="Assigned Categories">
            <Select
              mode="multiple"
              options={categories.map((category) => ({ value: category.id, label: category.name }))}
            />
          </Form.Item>
          <Form.Item name="is_active" label="Active" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={passwordModalOpen}
        title={`Reset Password${editingJudge ? `: ${editingJudge.display_name}` : ''}`}
        onCancel={() => setPasswordModalOpen(false)}
        onOk={() => void passwordForm.submit()}
        confirmLoading={saving}
      >
        <Form form={passwordForm} layout="vertical" onFinish={handleResetPassword}>
          <Form.Item name="password" label="New Password" rules={[{ required: true }]}>
            <Input.Password />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
