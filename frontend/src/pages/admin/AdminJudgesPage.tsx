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
      messageApi.error(error instanceof ApiError ? error.message : 'ไม่สามารถโหลดรายชื่อกรรมการได้');
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
      messageApi.error(error instanceof ApiError ? error.message : 'ไม่สามารถโหลดการมอบหมายหมวดหมู่ได้');
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
      messageApi.success(`${editingJudge ? 'แก้ไข' : 'สร้าง'}กรรมการสำเร็จแล้ว`);
    } catch (error) {
      messageApi.error(error instanceof ApiError ? error.message : 'ไม่สามารถบันทึกข้อมูลกรรมการได้');
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
      messageApi.success('ปิดการใช้งานผู้ใช้แล้ว');
    } catch (error) {
      messageApi.error(error instanceof ApiError ? error.message : 'ไม่สามารถปิดการใช้งานผู้ใช้ได้');
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
      messageApi.success('ตั้งรหัสผ่านใหม่สำเร็จแล้ว');
    } catch (error) {
      messageApi.error(error instanceof ApiError ? error.message : 'ไม่สามารถตั้งรหัสผ่านใหม่ได้');
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
            จัดการกรรมการ
          </Typography.Title>
          <Typography.Paragraph className="page-subtitle">
            สร้างบัญชีกรรมการ ควบคุมสิทธิ์การเข้าถึง ตั้งรหัสผ่านใหม่
            และมอบหมายหมวดหมู่ที่กรรมการแต่ละคนต้องตัดสิน
          </Typography.Paragraph>
        </section>

        <Card className="soft-card">
          <div className="table-toolbar">
            <Typography.Title level={4} style={{ margin: 0 }}>
              กรรมการและผู้ดูแลระบบ
            </Typography.Title>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
              สร้างผู้ใช้ใหม่
            </Button>
          </div>

          <Table<User>
            rowKey="id"
            loading={loading}
            dataSource={judges}
            pagination={false}
            columns={[
              { title: 'ชื่อที่แสดง', dataIndex: 'display_name' },
              { title: 'ชื่อผู้ใช้', dataIndex: 'username' },
              { title: 'บทบาท', dataIndex: 'role', width: 120 },
              {
                title: 'สถานะ',
                dataIndex: 'is_active',
                width: 120,
                render: (value: boolean) =>
                  value ? <Typography.Text style={{ color: '#4f7a57' }}>เปิดใช้งาน</Typography.Text> : 'ปิดใช้งาน',
              },
              {
                title: 'การจัดการ',
                width: 260,
                render: (_, record) => (
                  <Space>
                    <Button icon={<EditOutlined />} onClick={() => void openEditModal(record)}>
                      แก้ไข
                    </Button>
                    <Button
                      icon={<KeyOutlined />}
                      onClick={() => {
                        setEditingJudge(record);
                        setPasswordModalOpen(true);
                      }}
                    >
                      ตั้งรหัสผ่านใหม่
                    </Button>
                    <Popconfirm title="ปิดการใช้งานผู้ใช้นี้หรือไม่?" onConfirm={() => void handleDelete(record.id)}>
                      <Button danger icon={<DeleteOutlined />}>
                        ปิดการใช้งาน
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
        title={editingJudge ? 'แก้ไขผู้ใช้' : 'สร้างผู้ใช้'}
        onCancel={() => setModalOpen(false)}
        onOk={() => void form.submit()}
        confirmLoading={saving}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit} initialValues={blankJudge}>
          <Form.Item name="username" label="ชื่อผู้ใช้" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="display_name" label="ชื่อที่แสดง" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          {!editingJudge ? (
            <Form.Item name="password" label="รหัสผ่าน" rules={[{ required: true }]}>
              <Input.Password />
            </Form.Item>
          ) : null}
          <Form.Item name="role" label="บทบาท" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'judge', label: 'กรรมการ' },
                { value: 'admin', label: 'ผู้ดูแลระบบ' },
              ]}
            />
          </Form.Item>
          <Form.Item name="category_ids" label="หมวดหมู่ที่ได้รับมอบหมาย">
            <Select
              mode="multiple"
              options={categories.map((category) => ({ value: category.id, label: category.name }))}
            />
          </Form.Item>
          <Form.Item name="is_active" label="เปิดใช้งาน" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={passwordModalOpen}
        title={`ตั้งรหัสผ่านใหม่${editingJudge ? `: ${editingJudge.display_name}` : ''}`}
        onCancel={() => setPasswordModalOpen(false)}
        onOk={() => void passwordForm.submit()}
        confirmLoading={saving}
      >
        <Form form={passwordForm} layout="vertical" onFinish={handleResetPassword}>
          <Form.Item name="password" label="รหัสผ่านใหม่" rules={[{ required: true }]}>
            <Input.Password />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
