import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import {
  Button,
  Card,
  Form,
  Input,
  Modal,
  Popconfirm,
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
import type { Category, CategoryPayload } from '../../types/domain';

export function AdminCategoriesPage() {
  const { token } = useAuth();
  const [form] = Form.useForm<CategoryPayload>();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [saving, setSaving] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();

  async function loadCategories() {
    if (!token) {
      return;
    }
    setLoading(true);
    try {
      setCategories(await adminApi.getAdminCategories(token));
    } catch (error) {
      messageApi.error(error instanceof ApiError ? error.message : 'ไม่สามารถโหลดหมวดหมู่ได้');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadCategories();
  }, [token]);

  function openCreateModal() {
    setEditingCategory(null);
    form.setFieldsValue({ name: '', description: '', is_active: true });
    setModalOpen(true);
  }

  function openEditModal(category: Category) {
    setEditingCategory(category);
    form.setFieldsValue({
      name: category.name,
      description: category.description,
      is_active: category.is_active,
    });
    setModalOpen(true);
  }

  async function handleSubmit(values: CategoryPayload) {
    if (!token) {
      return;
    }

    setSaving(true);
    try {
      if (editingCategory) {
        await adminApi.updateCategory(token, editingCategory.id, values);
      } else {
        await adminApi.createCategory(token, values);
      }
      setModalOpen(false);
      await loadCategories();
      messageApi.success(`${editingCategory ? 'แก้ไข' : 'สร้าง'}หมวดหมู่สำเร็จแล้ว`);
    } catch (error) {
      messageApi.error(error instanceof ApiError ? error.message : 'ไม่สามารถบันทึกหมวดหมู่ได้');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!token) {
      return;
    }
    try {
      await adminApi.deleteCategory(token, id);
      await loadCategories();
      messageApi.success('ปิดการใช้งานหมวดหมู่แล้ว');
    } catch (error) {
      messageApi.error(error instanceof ApiError ? error.message : 'ไม่สามารถปิดการใช้งานหมวดหมู่ได้');
    }
  }

  return (
    <>
      {contextHolder}
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <section className="page-hero">
          <Typography.Title className="page-title" level={1}>
            จัดการหมวดหมู่
          </Typography.Title>
          <Typography.Paragraph className="page-subtitle">
            สร้างกลุ่มรางวัล ปรับคำอธิบาย และควบคุมว่าหมวดหมู่ใดสามารถใช้สำหรับมอบหมายผลงาน
            และการตัดสินได้
          </Typography.Paragraph>
        </section>

        <Card className="soft-card">
          <div className="table-toolbar">
            <Typography.Title level={4} style={{ margin: 0 }}>
              หมวดหมู่
            </Typography.Title>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
              สร้างหมวดหมู่ใหม่
            </Button>
          </div>

          <Table<Category>
            rowKey="id"
            loading={loading}
            dataSource={categories}
            pagination={false}
            columns={[
              { title: 'ชื่อ', dataIndex: 'name' },
              {
                title: 'คำอธิบาย',
                dataIndex: 'description',
                render: (value: string) => value || <Typography.Text type="secondary">ไม่มีคำอธิบาย</Typography.Text>,
              },
              {
                title: 'สถานะ',
                dataIndex: 'is_active',
                render: (value: boolean) =>
                  value ? <Typography.Text style={{ color: '#4f7a57' }}>เปิดใช้งาน</Typography.Text> : 'ปิดใช้งาน',
              },
              {
                title: 'การจัดการ',
                width: 180,
                render: (_, record) => (
                  <Space>
                    <Button icon={<EditOutlined />} onClick={() => openEditModal(record)}>
                      แก้ไข
                    </Button>
                    <Popconfirm
                      title="ปิดการใช้งานหมวดหมู่นี้หรือไม่?"
                      onConfirm={() => void handleDelete(record.id)}
                    >
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
        title={editingCategory ? 'แก้ไขหมวดหมู่' : 'สร้างหมวดหมู่'}
        onCancel={() => setModalOpen(false)}
        onOk={() => void form.submit()}
        confirmLoading={saving}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit} initialValues={{ is_active: true }}>
          <Form.Item name="name" label="ชื่อหมวดหมู่" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="คำอธิบาย">
            <Input.TextArea rows={4} />
          </Form.Item>
          <Form.Item name="is_active" label="เปิดใช้งาน" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
